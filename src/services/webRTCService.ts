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
    private makingOffer: Set<string> = new Set();
    // File d'attente des ICE candidates reçus avant setRemoteDescription
    private iceCandidateQueue: Map<string, RTCIceCandidateInit[]> = new Map();

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
        // Fermer toute connexion existante avant d'en créer une nouvelle
        const existing = this.peerConnections.get(remoteSocketId);
        if (existing) {
            existing.close();
            this.peerConnections.delete(remoteSocketId);
        }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // Ajouter les tracks locaux
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                pc.addTrack(track, this.localStream!);
            });
        }

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
                this.onRemoteStreamHandlers.forEach((handler) =>
                    handler({ socketId: remoteSocketId, stream })
                );
            }
        };

        // @ts-ignore
        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            console.log(`ICE (${remoteSocketId}): ${state}`);
            if (state === 'failed') {
                // @ts-ignore
                pc.restartIce?.();
            }
        };

        this.peerConnections.set(remoteSocketId, pc);
        // Initialiser la file d'attente ICE pour ce pair
        this.iceCandidateQueue.set(remoteSocketId, []);
        return pc;
    }

    private getPeerConnection(remoteSocketId: string): RTCPeerConnection | undefined {
        const pc = this.peerConnections.get(remoteSocketId);
        if (!pc || pc.connectionState === 'closed') {
            this.peerConnections.delete(remoteSocketId);
            return undefined;
        }
        return pc;
    }

    // Vider la file d'attente ICE une fois remoteDescription défini
    private async drainIceCandidateQueue(remoteSocketId: string, pc: RTCPeerConnection) {
        const queue = this.iceCandidateQueue.get(remoteSocketId) ?? [];
        for (const candidate of queue) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.warn(`ICE queue drain failed (${remoteSocketId}):`, e);
            }
        }
        this.iceCandidateQueue.set(remoteSocketId, []);
    }

    async callParticipant(remoteSocketId: string) {
        if (this.makingOffer.has(remoteSocketId)) return;

        this.makingOffer.add(remoteSocketId);
        try {
            const pc = this.createPeerConnection(remoteSocketId);
            const offer = await pc.createOffer({});
            await pc.setLocalDescription(offer);
            socketService.getSocket().emit('webrtc:offer', {
                to: remoteSocketId,
                offer: pc.localDescription,
            });
        } catch (error) {
            console.warn(`callParticipant failed (${remoteSocketId}):`, error);
            this.removeParticipant(remoteSocketId);
        } finally {
            this.makingOffer.delete(remoteSocketId);
        }
    }

    async handleOffer(fromSocketId: string, offer: StrictSessionDescriptionInit) {
        try {
            // Toujours créer une nouvelle pc pour répondre à une offre
            const pc = this.createPeerConnection(fromSocketId);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            // Vider la file d'attente ICE maintenant que remoteDescription est défini
            await this.drainIceCandidateQueue(fromSocketId, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketService.getSocket().emit('webrtc:answer', {
                to: fromSocketId,
                answer: pc.localDescription,
            });
        } catch (error) {
            console.warn(`handleOffer failed (${fromSocketId}):`, error);
            this.removeParticipant(fromSocketId);
        }
    }

    async handleAnswer(fromSocketId: string, answer: StrictSessionDescriptionInit) {
        try {
            const pc = this.getPeerConnection(fromSocketId);
            if (!pc) return;
            if (pc.signalingState !== 'have-local-offer') return;
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            // Vider la file d'attente ICE maintenant que remoteDescription est défini
            await this.drainIceCandidateQueue(fromSocketId, pc);
        } catch (error) {
            console.warn(`handleAnswer failed (${fromSocketId}):`, error);
        }
    }

    async handleIceCandidate(fromSocketId: string, candidate: RTCIceCandidateInit) {
        try {
            const pc = this.getPeerConnection(fromSocketId);
            if (!pc || !candidate) return;

            // Si remoteDescription pas encore défini, mettre en file d'attente
            if (!pc.remoteDescription) {
                const queue = this.iceCandidateQueue.get(fromSocketId) ?? [];
                queue.push(candidate);
                this.iceCandidateQueue.set(fromSocketId, queue);
                return;
            }

            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.warn(`handleIceCandidate failed (${fromSocketId}):`, error);
        }
    }

    removeParticipant(socketId: string) {
        const pc = this.peerConnections.get(socketId);
        pc?.close();
        this.peerConnections.delete(socketId);
        this.makingOffer.delete(socketId);
        this.iceCandidateQueue.delete(socketId);
        this.onRemoteStreamRemovedHandlers.forEach((handler) => handler(socketId));
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
        this.iceCandidateQueue.clear();
        this.localStream?.getTracks().forEach((track) => track.stop());
        this.localStream = null;
    }
}

export const webRTCService = new WebRTCService();
