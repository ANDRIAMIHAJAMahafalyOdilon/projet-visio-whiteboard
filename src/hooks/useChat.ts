import { useState, useEffect, useCallback } from 'react';
import { socketService } from '@/services/socketService';

export interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    timestamp: string;
}

export function useChat(roomId: string, username: string) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    useEffect(() => {
        const socket = socketService.getSocket();

        const onChatMessage = (message: ChatMessage) => {
            setMessages((prev) => {
                if (prev.some((m) => m.id === message.id)) return prev;
                return [...prev, message];
            });
        };

        socket.on('chat:message', onChatMessage);

        // Gérer le cas où le socket se reconnecte (re-attacher les listeners si nécessaire,
        // bien que socket.io le fasse si l'objet est le même)
        return () => {
            socket.off('chat:message', onChatMessage);
        };
    }, []);

    const sendMessage = useCallback((text: string) => {
        if (!text.trim()) return;
        socketService.getSocket().emit('chat:send', {
            roomId,
            text: text.trim(),
        });
    }, [roomId]);


    return { messages, sendMessage };
}
