import { useState, useEffect, useCallback } from 'react';
import { socketService } from '@/services/socketService';

export interface RaisedHandEntry {
    socketId: string;
    username: string;
}

export function useRaisedHand(roomId: string) {
    const [raisedHands, setRaisedHands] = useState<RaisedHandEntry[]>([]);
    const [isHandRaised, setIsHandRaised] = useState(false);

    useEffect(() => {
        const socket = socketService.getSocket();

        socket.on('hand:update', ({ socketId, username, raised }) => {
            setRaisedHands((prev) => {
                const others = prev.filter((e) => e.socketId !== socketId);
                return raised ? [...others, { socketId, username }] : others;
            });
        });

        socket.on('room:user-left', (socketId: string) => {
            setRaisedHands((prev) => prev.filter((e) => e.socketId !== socketId));
        });

        return () => { socket.off('hand:update'); };
    }, []);

    const toggleHand = useCallback(() => {
        setIsHandRaised((prev) => {
            const next = !prev;
            socketService.getSocket().emit('hand:toggle', { roomId, raised: next });
            return next;
        });
    }, [roomId]);

    return { raisedHands, isHandRaised, toggleHand };
}