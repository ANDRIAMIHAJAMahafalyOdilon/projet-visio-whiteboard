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

    async getLocalStream(): Promise<MediaStream> {
        if (this.localStream) return this.localStream;
        try {
            // @ts-ignore - typage RN spécifique pour mediaDevices
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
        const existing = this.peerConnections.get(remoteSocketId);
        if (existing && existing.connectionState !== 'closed') {
            existing.close();
        }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

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
            const stream = event.streams && event.streams[0];
            if (stream) {
                this.onRemoteStreamHandlers.forEach((handler) =>
                    handler({ socketId: remoteSocketId, stream })
                );
            }
        };

        // @ts-ignore
        pc.oniceconnectionstatechange = () => {
            console.log(`ICE state (${remoteSocketId}):`, pc.iceConnectionState);
        };

        // @ts-ignore
        pc.onconnectionstatechange = () => {
            // @ts-ignore
            console.log(`Connection state (${remoteSocketId}):`, pc.connectionState);
        };

        this.peerConnections.set(remoteSocketId, pc);
        return pc;
    }

    private getPeerConnection(remoteSocketId: string): RTCPeerConnection | undefined {
        const pc = this.peerConnections.get(remoteSocketId);
        if (pc && pc.connectionState === 'closed') {
            this.peerConnections.delete(remoteSocketId);
            return undefined;
        }
        return pc;
    }

    async callParticipant(remoteSocketId: string) {
        if (this.makingOffer.has(remoteSocketId)) return;

        const existing = this.getPeerConnection(remoteSocketId);
        if (existing) {
            const state = existing.signalingState;
            if (state === 'stable' && existing.currentRemoteDescription) return;
            if (state === 'have-local-offer' || state === 'have-remote-offer') return;
        }

        this.makingOffer.add(remoteSocketId);
        try {
            const pc = this.createPeerConnection(remoteSocketId);
            const offer = await pc.createOffer({});
            await pc.setLocalDescription(offer);
            socketService.getSocket().emit('webrtc:offer', { to: remoteSocketId, offer });
        } catch (error) {
            console.warn(`callParticipant failed (${remoteSocketId}):`, error);
            this.removeParticipant(remoteSocketId);
        } finally {
            this.makingOffer.delete(remoteSocketId);
        }
    }

    async handleOffer(fromSocketId: string, offer: StrictSessionDescriptionInit) {
        const existing = this.getPeerConnection(fromSocketId);
        if (existing?.signalingState === 'have-local-offer') {
            return;
        }

        try {
            const pc = existing ?? this.createPeerConnection(fromSocketId);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketService.getSocket().emit('webrtc:answer', { to: fromSocketId, answer });
        } catch (error) {
            console.warn(`handleOffer failed (${fromSocketId}):`, error);
            this.removeParticipant(fromSocketId);
        }
    }

    async handleAnswer(fromSocketId: string, answer: StrictSessionDescriptionInit) {
        try {
            const pc = this.getPeerConnection(fromSocketId);
            if (!pc || pc.signalingState !== 'have-local-offer') return;
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.warn(`handleAnswer failed (${fromSocketId}):`, error);
        }
    }

    async handleIceCandidate(fromSocketId: string, candidate: RTCIceCandidateInit) {
        try {
            const pc = this.getPeerConnection(fromSocketId);
            if (!pc || !candidate) return;
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
        this.localStream?.getTracks().forEach((track) => track.stop());
        this.localStream = null;
    }
}

export const webRTCService = new WebRTCService();
