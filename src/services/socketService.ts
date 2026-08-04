import { io, Socket } from 'socket.io-client';
import { SIGNALING_SERVER_URL } from '@/utils/constants';
import { Stroke } from '@/utils/drawUtils';

export interface RoomParticipant {
    socketId: string;
    username: string;
}

interface ServerToClientEvents {
    'room:participants': (participants: RoomParticipant[]) => void;
    'room:user-joined': (participant: RoomParticipant) => void;
    'room:user-left': (socketId: string) => void;
    'room:error': (payload: { message: string }) => void;
    'room:you-are-host': () => void;
    'webrtc:offer': (payload: { from: string; offer: RTCSessionDescriptionInit }) => void;
    'webrtc:answer': (payload: { from: string; answer: RTCSessionDescriptionInit }) => void;
    'webrtc:ice-candidate': (payload: { from: string; candidate: RTCIceCandidateInit }) => void;
    'whiteboard:stroke-start': (stroke: Stroke) => void;
    'whiteboard:stroke-update': (payload: { id: string; points: Stroke['points'] }) => void;
    'whiteboard:stroke-end': (payload: { id: string }) => void;
    'whiteboard:clear': () => void;
    // Permission de dessin — reçu par l'hôte quand un participant demande
    'whiteboard:draw-request': (payload: { socketId: string; username: string }) => void;
    // Reçu par le participant selon la décision de l'hôte
    'whiteboard:draw-granted': () => void;
    'whiteboard:draw-denied': () => void;
    'chat:message': (payload: { id: string; sender: string; text: string; timestamp: string }) => void;
    'hand:update': (payload: { socketId: string; username: string; raised: boolean }) => void;
}

interface ClientToServerEvents {
    'room:join': (payload: { roomId: string; username: string; isHost: boolean }) => void;
    'webrtc:offer': (payload: { to: string; offer: RTCSessionDescriptionInit }) => void;
    'webrtc:answer': (payload: { to: string; answer: RTCSessionDescriptionInit }) => void;
    'webrtc:ice-candidate': (payload: { to: string; candidate: RTCIceCandidateInit }) => void;
    'whiteboard:stroke-start': (stroke: Stroke) => void;
    'whiteboard:stroke-update': (payload: { id: string; points: Stroke['points'] }) => void;
    'whiteboard:stroke-end': (payload: { id: string }) => void;
    'whiteboard:clear': () => void;
    // Participant → serveur → hôte
    'whiteboard:request-draw': (payload: { roomId: string }) => void;
    // Hôte → serveur → participant
    'whiteboard:allow-draw': (payload: { targetSocketId: string }) => void;
    'whiteboard:deny-draw': (payload: { targetSocketId: string }) => void;
    'chat:send': (payload: { roomId: string; sender: string; text: string }) => void;
    'hand:toggle': (payload: { roomId: string; raised: boolean }) => void;
}

class SocketService {
    private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

    connect() {
        if (this.socket?.connected) return this.socket;
        this.socket = io(SIGNALING_SERVER_URL, {
            transports: ['websocket'],
            reconnectionAttempts: 5,
        });
        return this.socket;
    }

    getSocket() {
        if (!this.socket) return this.connect();
        return this.socket;
    }

    waitForConnect(): Promise<void> {
        const socket = this.getSocket();
        if (socket.connected) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                socket.off('connect', onConnect);
                reject(new Error('Connexion au serveur impossible. Vérifie ta connexion internet.'));
            }, 10000);

            const onConnect = () => {
                clearTimeout(timeout);
                resolve();
            };

            socket.once('connect', onConnect);
        });
    }

    joinRoom(roomId: string, username: string, isHost: boolean) {
        this.getSocket().emit('room:join', { roomId, username, isHost });
    }

    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
    }
}

export const socketService = new SocketService();
