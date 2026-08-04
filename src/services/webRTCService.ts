import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    MediaStream,
    mediaDevices,
} from 'react-native-webrtc';
import { ICE_SERVERS } from '@/utils/constants';
import { socketService } from './socketService';

export interface RemoteStreamEntry {
    socketId: string;
    stream: MediaStream;
}

export interface StrictSessionDescriptionInit {
    type: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp: string;
}

type RemoteStreamHandler = (entry: RemoteStreamEntry) => void;
type RemoteStreamRemovedHandler = (socketId: string) => void;

class WebRTCService {
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private localStream: MediaStream | null = null;
    private onRemoteStreamHandlers: RemoteStreamHandler[] = [];
    private onRemoteStreamRemovedHandlers: RemoteStreamRemovedHandler[] = [];
    // Garde trace des IDs en cours d'offer pour éviter les doublons
    private makingOffer: Set<string> = new Set();
    // Garde trace de notre propre socketId pour la règle de "glare resolution"
    private mySocketId: string = '';

    setMySocketId(id: string) {
        this.mySocketId = id;
    }

    async getLocalStream(): Promise<MediaStream> {
        if (this.localStream) return this.localStream;
        try {
            // @ts-ignore
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
            });
            this.localStream = stream as unknown as MediaStream;
            return this.localStream;
        } catch (error) {
            throw new Error(
                "Impossible d'accéder à la caméra ou au micro. Vérifie les autorisations de l'application."
            );
        }
    }

    toggleAudio(enabled: boolean) {
        this.localStream?.getAudioTracks().forEach((track) => (track.enabled = enabled));
    }

    toggleVideo(enabled: boolean) {
        this.localStream?.getVideoTracks().forEach((track) => (track.enabled = enabled));
    }

    private createPeerConnection(remoteSocketId: string): RTCPeerConnection {
        // Ne jamais recréer une connexion déjà active
        const existing = this.peerConnections.get(remoteSocketId);
        if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
            return existing;
        }
        if (existing) {
            existing.close();
            this.peerConnections.delete(remoteSocketId);
        }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // Ajouter les tracks locaux
        this.localStream?.getTracks().forEach((track) => {
            pc.addTrack(track, this.localStream!);
        });

        // @ts-ignore
        pc.onicecandidate = (event: any) => {
            if (event.candidate) {
                socketService.getSocket().emit('webrtc:ice-candidate', {
                    to: remoteSocketId,
                    candidate: event.candidate,
                });
            }
        };

        // @ts-ignore
        pc.ontrack = (event: any) => {
            const stream = event.streams?.[0];
            if (stream) {
                this.onRemoteStreamHandlers.forEach((h) =>
                    h({ socketId: remoteSocketId, stream })
                );
            }
        };

        // @ts-ignore
        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            console.log(`ICE [${remoteSocketId}]: ${state}`);
            if (state === 'failed') {
                // @ts-ignore
                if (typeof pc.restartIce === 'function') pc.restartIce();
            }
        };

        this.peerConnections.set(remoteSocketId, pc);
        return pc;
    }

    private getPeerConnection(remoteSocketId: string): RTCPeerConnection | undefined {
        const pc = this.peerConnections.get(remoteSocketId);
        if (!pc) return undefined;
        if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
            this.peerConnections.delete(remoteSocketId);
            return undefined;
        }
        return pc;
    }

    // Appelé uniquement par le NOUVEL arrivant vers les participants existants
    async callParticipant(remoteSocketId: string) {
        if (this.makingOffer.has(remoteSocketId)) return;
        const existing = this.getPeerConnection(remoteSocketId);
        // Si la connexion est déjà établie, ne pas re-caller
        if (existing?.signalingState === 'stable' && existing.currentRemoteDescription) return;

        this.makingOffer.add(remoteSocketId);
        try {
            const pc = this.createPeerConnection(remoteSocketId);
            const offer = await pc.createOffer({});
            await pc.setLocalDescription(offer);
            socketService.getSocket().emit('webrtc:offer', {
                to: remoteSocketId,
                offer: { type: offer.type, sdp: offer.sdp },
            });
        } catch (error) {
            console.warn(`callParticipant failed [${remoteSocketId}]:`, error);
        } finally {
            this.makingOffer.delete(remoteSocketId);
        }
    }

    async handleOffer(fromSocketId: string, offer: StrictSessionDescriptionInit) {
        try {
            let pc = this.getPeerConnection(fromSocketId);

            // Glare resolution : si les deux côtés ont envoyé un offer simultanément,
            // le socket avec l'ID lexicographiquement supérieur cède (rollback + accepte l'offer entrant)
            if (pc?.signalingState === 'have-local-offer') {
                const weYield = this.mySocketId < fromSocketId;
                if (!weYield) {
                    // On ignore l'offer entrant, l'autre va accepter le nôtre
                    return;
                }
                // On annule notre offer et on accepte le leur
                await pc.setLocalDescription({ type: 'rollback' } as any);
            }

            if (!pc) {
                pc = this.createPeerConnection(fromSocketId);
            }

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketService.getSocket().emit('webrtc:answer', {
                to: fromSocketId,
                answer: { type: answer.type, sdp: answer.sdp },
            });
        } catch (error) {
            console.warn(`handleOffer failed [${fromSocketId}]:`, error);
        }
    }

    async handleAnswer(fromSocketId: string, answer: StrictSessionDescriptionInit) {
        try {
            const pc = this.getPeerConnection(fromSocketId);
            if (!pc) return;
            if (pc.signalingState !== 'have-local-offer') return;
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.warn(`handleAnswer failed [${fromSocketId}]:`, error);
        }
    }

    async handleIceCandidate(fromSocketId: string, candidate: RTCIceCandidateInit) {
        try {
            const pc = this.getPeerConnection(fromSocketId);
            if (!pc || !candidate) return;
            // Attendre que la remote description soit définie avant d'ajouter le candidat
            if (!pc.remoteDescription) {
                // Réessayer dans 500ms
                setTimeout(() => this.handleIceCandidate(fromSocketId, candidate), 500);
                return;
            }
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.warn(`handleIceCandidate failed [${fromSocketId}]:`, error);
        }
    }

    removeParticipant(socketId: string) {
        const pc = this.peerConnections.get(socketId);
        pc?.close();
        this.peerConnections.delete(socketId);
        this.makingOffer.delete(socketId);
        this.onRemoteStreamRemovedHandlers.forEach((h) => h(socketId));
    }

    onRemoteStream(handler: RemoteStreamHandler) {
        this.onRemoteStreamHandlers.push(handler);
        return () => {
            this.onRemoteStreamHandlers = this.onRemoteStreamHandlers.filter((h) => h !== handler);
        };
    }

    onRemoteStreamRemoved(handler: RemoteStreamRemovedHandler) {
        this.onRemoteStreamRemovedHandlers.push(handler);
        return () => {
            this.onRemoteStreamRemovedHandlers = this.onRemoteStreamRemovedHandlers.filter(
                (h) => h !== handler
            );
        };
    }

    cleanup() {
        this.peerConnections.forEach((pc) => pc.close());
        this.peerConnections.clear();
        this.makingOffer.clear();
        this.mySocketId = '';
        this.localStream?.getTracks().forEach((track) => track.stop());
        this.localStream = null;
    }
}

export const webRTCService = new WebRTCService();
