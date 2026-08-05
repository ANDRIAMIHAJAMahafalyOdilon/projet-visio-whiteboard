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

type RemoteStreamHandler = (entry: RemoteStreamEntry) => void;
type RemoteStreamRemovedHandler = (socketId: string) => void;

class WebRTCService {
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private localStream: MediaStream | null = null;
    private onRemoteStreamHandlers: RemoteStreamHandler[] = [];
    private onRemoteStreamRemovedHandlers: RemoteStreamRemovedHandler[] = [];

    // "polite" = celui qui cède en cas de collision d'offers (le nouveau venu est poli)
    private isPolite = false;
    private makingOffer: Set<string> = new Set();
    private ignoreOffer: Set<string> = new Set();

    setPolite(polite: boolean) {
        this.isPolite = polite;
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
        } catch {
            throw new Error(
                "Impossible d'accéder à la caméra ou au micro. Vérifie les autorisations de l'application."
            );
        }
    }

    toggleAudio(enabled: boolean) {
        this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
    }

    toggleVideo(enabled: boolean) {
        this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
    }

    private getOrCreatePeerConnection(remoteSocketId: string): RTCPeerConnection {
        const existing = this.peerConnections.get(remoteSocketId);
        // Réutilise la connexion existante sauf si elle est fermée
        if (existing && (existing as any).connectionState !== 'closed') {
            return existing;
        }
        return this.createPeerConnection(remoteSocketId);
    }

    private createPeerConnection(remoteSocketId: string): RTCPeerConnection {
        // Ferme proprement la connexion existante si elle existe
        const existing = this.peerConnections.get(remoteSocketId);
        if (existing) {
            try { existing.close(); } catch {}
        }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // Ajoute les tracks locaux dans la connexion
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                (pc as any).addTrack(track, this.localStream!);
            });
        }

        // Envoie les candidats ICE au pair distant
        (pc as any).onicecandidate = (event: any) => {
            if (event.candidate) {
                socketService.getSocket().emit('webrtc:ice-candidate', {
                    to: remoteSocketId,
                    candidate: event.candidate.toJSON(),
                });
            }
        };

        // Reçoit le flux vidéo distant
        (pc as any).ontrack = (event: any) => {
            const stream = event.streams?.[0];
            if (stream) {
                this.onRemoteStreamHandlers.forEach((h) =>
                    h({ socketId: remoteSocketId, stream })
                );
            }
        };

        // Gère la renegociation (nécessaire pour perfect negotiation)
        (pc as any).onnegotiationneeded = async () => {
            try {
                this.makingOffer.add(remoteSocketId);
                const offer = await pc.createOffer({});
                // Annule si l'état a changé pendant l'attente
                if ((pc as any).signalingState !== 'stable') return;
                await pc.setLocalDescription(offer);
                socketService.getSocket().emit('webrtc:offer', {
                    to: remoteSocketId,
                    offer: pc.localDescription as RTCSessionDescriptionInit,
                });
            } catch (err) {
                console.warn('onnegotiationneeded error:', err);
            } finally {
                this.makingOffer.delete(remoteSocketId);
            }
        };

        (pc as any).oniceconnectionstatechange = () => {
            if ((pc as any).iceConnectionState === 'failed') {
                (pc as any).restartIce?.();
            }
        };

        this.peerConnections.set(remoteSocketId, pc);
        return pc;
    }

    // Appelé quand on rejoint et qu'il y a déjà des participants
    async callParticipant(remoteSocketId: string) {
        // Crée la connexion — onnegotiationneeded enverra l'offer automatiquement
        this.getOrCreatePeerConnection(remoteSocketId);
    }

    // Perfect negotiation pattern pour handleOffer
    async handleOffer(fromSocketId: string, offer: { type: 'offer'; sdp: string }) {
        const pc = this.getOrCreatePeerConnection(fromSocketId);

        const offerCollision =
            this.makingOffer.has(fromSocketId) ||
            (pc as any).signalingState !== 'stable';

        // Le pair "impoli" ignore l'offer en collision, le pair "poli" la traite
        this.ignoreOffer.add(fromSocketId);
        if (offerCollision && !this.isPolite) {
            this.ignoreOffer.delete(fromSocketId);
            return;
        }
        this.ignoreOffer.delete(fromSocketId);

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketService.getSocket().emit('webrtc:answer', {
                to: fromSocketId,
                answer: pc.localDescription as RTCSessionDescriptionInit,
            });
        } catch (err) {
            console.warn(`handleOffer failed (${fromSocketId}):`, err);
        }
    }

    async handleAnswer(fromSocketId: string, answer: { type: 'answer'; sdp: string }) {
        const pc = this.peerConnections.get(fromSocketId);
        if (!pc) return;
        // Ignore si on n'attend pas de réponse
        if ((pc as any).signalingState !== 'have-local-offer') return;
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
            console.warn(`handleAnswer failed (${fromSocketId}):`, err);
        }
    }

    async handleIceCandidate(fromSocketId: string, candidate: RTCIceCandidateInit) {
        const pc = this.peerConnections.get(fromSocketId);
        if (!pc || !candidate?.candidate) return;
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            // Ignore les candidats en doublon (normal avec perfect negotiation)
            if (!(err instanceof Error && err.message.includes('duplicate'))) {
                console.warn(`handleIceCandidate failed (${fromSocketId}):`, err);
            }
        }
    }

    removeParticipant(socketId: string) {
        const pc = this.peerConnections.get(socketId);
        if (pc) {
            try { pc.close(); } catch {}
            this.peerConnections.delete(socketId);
        }
        this.makingOffer.delete(socketId);
        this.ignoreOffer.delete(socketId);
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
        this.peerConnections.forEach((pc) => { try { pc.close(); } catch {} });
        this.peerConnections.clear();
        this.makingOffer.clear();
        this.ignoreOffer.clear();
        this.localStream?.getTracks().forEach((t) => t.stop());
        this.localStream = null;
    }
}

export const webRTCService = new WebRTCService();
