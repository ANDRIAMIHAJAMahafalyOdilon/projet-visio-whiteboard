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

        const onHandUpdate = ({ socketId, username, raised }: { socketId: string, username: string, raised: boolean }) => {
            setRaisedHands((prev) => {
                const others = prev.filter((e) => e.socketId !== socketId);
                return raised ? [...others, { socketId, username }] : others;
            });
        };

        const onUserLeft = (socketId: string) => {
            setRaisedHands((prev) => prev.filter((e) => e.socketId !== socketId));
        };

        socket.on('hand:update', onHandUpdate);
        socket.on('room:user-left', onUserLeft);

        return () => {
            socket.off('hand:update', onHandUpdate);
            socket.off('room:user-left', onUserLeft);
        };
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