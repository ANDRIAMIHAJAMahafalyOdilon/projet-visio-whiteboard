import { useState, useEffect, useCallback, useRef } from 'react';
import { socketService } from '@/services/socketService';

export interface RaisedHandEntry {
    socketId: string;
    username: string;
}

export function useRaisedHand(roomId: string) {
    const [raisedHands, setRaisedHands] = useState<RaisedHandEntry[]>([]);
    const [isHandRaised, setIsHandRaised] = useState(false);
    const raisedRef = useRef(false);

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

        const onParticipants = () => {
            // Rejoue l'état après une reconnexion et après le re-join serveur.
            socket.emit('hand:toggle', { raised: raisedRef.current });
        };

        socket.on('hand:update', onHandUpdate);
        socket.on('room:user-left', onUserLeft);
        socket.on('room:participants', onParticipants);

        return () => {
            socket.off('hand:update', onHandUpdate);
            socket.off('room:user-left', onUserLeft);
            socket.off('room:participants', onParticipants);
        };
    }, []);

    const toggleHand = useCallback(() => {
        setIsHandRaised((prev) => {
            const next = !prev;
            raisedRef.current = next;
            socketService.getSocket().emit('hand:toggle', { raised: next });
            return next;
        });
    }, []);

    return { raisedHands, isHandRaised, toggleHand };
}
