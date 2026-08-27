import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    MediaStream,
    MediaStreamTrack,
    mediaDevices,
} from 'react-native-webrtc';
import type RTCTrackEvent from 'react-native-webrtc/lib/typescript/RTCTrackEvent';
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
    private onScreenShareEndedHandlers: (() => void)[] = [];
    _screenTrack: MediaStreamTrack | null = null;
    _screenStream: MediaStream | null = null;

    private makingOffer: Set<string> = new Set();
    private ignoreOffer: Set<string> = new Set();
    private pendingIceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();

    async getLocalStream(): Promise<MediaStream> {
        if (this.localStream) return this.localStream;
        try {
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
            });
            this.localStream = stream;
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

    flipCamera() {
        const videoTrack = this.localStream?.getVideoTracks()[0];
        if (videoTrack) {
            // _switchCamera() bascule facingMode user↔environment sans recréer le stream
            (videoTrack as unknown as { _switchCamera: () => void })._switchCamera();
        }
    }

    async startScreenShare(): Promise<void> {
        const screenStream = await mediaDevices.getDisplayMedia({});
        const screenTrack = screenStream.getVideoTracks()[0];

        this.peerConnections.forEach((pc) => {
            const senders = pc.getSenders();
            const videoSender = senders.find((s) => s.track?.kind === 'video');
            if (videoSender) {
                videoSender.replaceTrack(screenTrack);
            }
        });

        this._screenTrack = screenTrack;
        this._screenStream = screenStream;

        screenTrack.onended = () => {
            this.stopScreenShare();
        };
    }

    async stopScreenShare(): Promise<void> {
        const cameraTrack = this.localStream?.getVideoTracks()[0];
        if (!cameraTrack) return;

        this.peerConnections.forEach((pc) => {
            const senders = pc.getSenders();
            const videoSender = senders.find((s) => s.track?.kind === 'video');
            if (videoSender) {
                videoSender.replaceTrack(cameraTrack);
            }
        });

        this._screenTrack?.stop();
        this._screenTrack = null;
        this._screenStream = null;
        this.onScreenShareEndedHandlers.forEach((h) => h());
    }

    onScreenShareEnded(handler: () => void) {
        this.onScreenShareEndedHandlers.push(handler);
        return () => {
            this.onScreenShareEndedHandlers = this.onScreenShareEndedHandlers.filter((h) => h !== handler);
        };
    }

    private getOrCreatePeerConnection(remoteSocketId: string): RTCPeerConnection {
        const existing = this.peerConnections.get(remoteSocketId);
        // Réutilise la connexion existante sauf si elle est fermée
        if (existing && existing.connectionState !== 'closed') {
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

        const pc = new RTCPeerConnection({
            iceServers: ICE_SERVERS,
            // Autorise à la fois P2P direct et relais TURN
            iceTransportPolicy: 'all',
        });

        // Timer pour détecter un ICE bloqué en 'checking' trop longtemps
        let iceCheckingTimer: ReturnType<typeof setTimeout> | null = null;
        // Compteur de tentatives ICE restart (max 3 avant d'abandonner)
        let iceRestartAttempts = 0;

        // Ajoute les tracks locaux dans la connexion
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                const trackToSend = track.kind === 'video' && this._screenTrack ? this._screenTrack : track;
                pc.addTrack(trackToSend, this.localStream!);
            });
        }

        pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate) {
                socketService.getSocket().emit('webrtc:ice-candidate', {
                    to: remoteSocketId,
                    candidate: event.candidate.toJSON(),
                });
            }
        };

        pc.ontrack = (event: RTCTrackEvent<'track'>) => {
            const stream = event.streams[0];
            if (stream) {
                this.onRemoteStreamHandlers.forEach((h) =>
                    h({ socketId: remoteSocketId, stream })
                );
            }
        };

        pc.onnegotiationneeded = async () => {
            if (this.makingOffer.has(remoteSocketId)) return; // déjà en cours
            try {
                this.makingOffer.add(remoteSocketId);
                const offer = await pc.createOffer({});
                // Vérifie APRÈS createOffer (peut prendre du temps)
                if (pc.signalingState !== 'stable') return;
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

        /**
         * Déclenche un ICE restart complet :
         * - createOffer({ iceRestart: true }) force de nouveaux candidats ICE
         * - le nouvel offer est envoyé à l'autre pair via signalement
         * IMPORTANT : pc.restartIce() seul ne suffit pas sur react-native-webrtc,
         * il faut impérativement renvoyer un offer avec iceRestart:true.
         */
        const triggerIceRestart = async () => {
            if (iceRestartAttempts >= 3) {
                console.warn(`[ICE] ${remoteSocketId}: trop de tentatives, abandon`);
                this.removeParticipant(remoteSocketId);
                return;
            }
            iceRestartAttempts++;
            console.log(`[ICE] Restart #${iceRestartAttempts} avec ${remoteSocketId}`);
            try {
                this.makingOffer.add(remoteSocketId);
                const offer = await pc.createOffer({ iceRestart: true } as RTCOfferOptions);
                if (pc.signalingState === 'closed') return;
                await pc.setLocalDescription(offer);
                socketService.getSocket().emit('webrtc:offer', {
                    to: remoteSocketId,
                    offer: pc.localDescription as RTCSessionDescriptionInit,
                });
            } catch (err) {
                console.warn(`[ICE] Restart échoué (${remoteSocketId}):`, err);
            } finally {
                this.makingOffer.delete(remoteSocketId);
            }
        };

        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            console.log(`[ICE] state with ${remoteSocketId}:`, state);

            // Annule le timer de timeout si ICE progresse
            if (state !== 'checking' && iceCheckingTimer) {
                clearTimeout(iceCheckingTimer);
                iceCheckingTimer = null;
            }

            if (state === 'checking') {
                // Timeout : si ICE reste en "checking" plus de 15s → restart
                iceCheckingTimer = setTimeout(() => {
                    if (pc.iceConnectionState === 'checking') {
                        console.warn(`[ICE] Timeout 'checking' avec ${remoteSocketId} → restart`);
                        triggerIceRestart();
                    }
                }, 15_000);
            }

            if (state === 'failed') {
                // ICE a échoué : on tente un restart complet avec nouvel offer
                triggerIceRestart();
            }

            if (state === 'connected' || state === 'completed') {
                // Connexion établie → reset le compteur pour les futurs restarts
                iceRestartAttempts = 0;
            }
        };

        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            console.log(`[CONN] state with ${remoteSocketId}:`, state);
            // On ne supprime le participant que si la connexion est fermée définitivement
            // (pas sur 'failed' seul — c'est géré par oniceconnectionstatechange)
            if (state === 'closed') {
                this.removeParticipant(remoteSocketId);
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
        // Rôle déterministe par paire : évite que deux participants non-hôtes
        // aient simultanément le même rôle lors d'une collision d'offers.
        const isPolite = (socketService.getSocket().id ?? '') < fromSocketId;

        const offerCollision =
            this.makingOffer.has(fromSocketId) ||
            pc.signalingState !== 'stable';

        // Le pair "impoli" ignore l'offer en collision
        if (offerCollision && !isPolite) {
            return;
        }

        // Le pair "poli" fait un rollback de son propre offer avant d'accepter
        if (offerCollision && isPolite) {
            try {
                await pc.setLocalDescription({ type: 'rollback', sdp: '' });
            } catch {}
        }

        try {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: offer.type, sdp: offer.sdp }));
            await this.flushPendingIceCandidates(fromSocketId, pc);
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
        if (pc.signalingState !== 'have-local-offer') return;
        try {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: answer.type, sdp: answer.sdp! }));
            await this.flushPendingIceCandidates(fromSocketId, pc);
        } catch (err) {
            console.warn(`handleAnswer failed (${fromSocketId}):`, err);
        }
    }

    async handleIceCandidate(fromSocketId: string, candidate: RTCIceCandidateInit) {
        const pc = this.peerConnections.get(fromSocketId);
        if (!pc || !candidate?.candidate) return;
        if (!pc.remoteDescription) {
            const pending = this.pendingIceCandidates.get(fromSocketId) ?? [];
            pending.push(candidate);
            this.pendingIceCandidates.set(fromSocketId, pending);
            return;
        }
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            // Ignore les candidats en doublon (normal avec perfect negotiation)
            if (!(err instanceof Error && err.message.includes('duplicate'))) {
                console.warn(`handleIceCandidate failed (${fromSocketId}):`, err);
            }
        }
    }

    private async flushPendingIceCandidates(socketId: string, pc: RTCPeerConnection) {
        const pending = this.pendingIceCandidates.get(socketId) ?? [];
        this.pendingIceCandidates.delete(socketId);
        for (const candidate of pending) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.warn(`pending ICE candidate failed (${socketId}):`, err);
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
        this.pendingIceCandidates.delete(socketId);
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
        this.pendingIceCandidates.clear();
        this._screenTrack?.stop();
        this._screenTrack = null;
        this._screenStream = null;
        this.localStream?.getTracks().forEach((t) => t.stop());
        this.localStream = null;
    }

    cleanupPeerConnections() {
        [...this.peerConnections.keys()].forEach((socketId) => this.removeParticipant(socketId));
        this.pendingIceCandidates.clear();
    }
}

export const webRTCService = new WebRTCService();
