import { io, Socket } from 'socket.io-client';
import { SIGNALING_SERVER_URL } from '@/utils/constants';
import { Stroke } from '@/utils/drawUtils';

export interface RoomParticipant {
    socketId: string;
    username: string;
}

export interface ChatMessagePayload {
    id: string;
    senderId: string;
    sender: string;
    text: string;
    timestamp: string;
}

interface ServerToClientEvents {
    'room:participants': (participants: RoomParticipant[]) => void;
    'room:user-joined': (participant: RoomParticipant) => void;
    'room:user-left': (socketId: string) => void;
    'room:error': (payload: { message: string }) => void;
    'room:you-are-host': () => void;
    'room:host': (payload: { socketId: string | null }) => void;
    'room:host-changed': (payload: { socketId: string }) => void;
    'webrtc:offer': (payload: { from: string; offer: RTCSessionDescriptionInit }) => void;
    'webrtc:answer': (payload: { from: string; answer: RTCSessionDescriptionInit }) => void;
    'webrtc:ice-candidate': (payload: { from: string; candidate: RTCIceCandidateInit }) => void;
    'whiteboard:stroke-start': (stroke: Stroke) => void;
    'whiteboard:stroke-update': (payload: { id: string; points: Stroke['points'] }) => void;
    'whiteboard:stroke-end': (payload: { id: string }) => void;
    'whiteboard:clear': () => void;
    'whiteboard:state': (strokes: Stroke[]) => void;
    'chat:message': (payload: ChatMessagePayload) => void;
    'chat:history': (payload: ChatMessagePayload[]) => void;
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
    'chat:send': (payload: { text: string }) => void;
    'hand:toggle': (payload: { raised: boolean }) => void;
}

class SocketService {
    private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

    connect() {
        if (this.socket) return this.socket;
        this.socket = io(SIGNALING_SERVER_URL, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
        });
        return this.socket;
    }

    getSocket() {
        return this.connect();
    }

    onReconnect(callback: () => void) {
        const socket = this.getSocket();
        socket.on('connect', callback);
        return () => socket.off('connect', callback);
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
