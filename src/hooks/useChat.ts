import { useState, useEffect, useCallback } from 'react';
import { socketService } from '@/services/socketService';

export interface ChatMessage {
    id: string;
    senderId: string;
    sender: string;
    text: string;
    timestamp: string;
    /** true si ce message a été envoyé par l'utilisateur local */
    isOwn: boolean;
}

export function useChat(roomId: string, username: string) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    useEffect(() => {
        const socket = socketService.getSocket();

        const onChatMessage = (message: Omit<ChatMessage, 'isOwn'>) => {
            setMessages((prev) => {
                if (prev.some((m) => m.id === message.id)) return prev;
                const isOwn = message.senderId === socket.id;
                return [...prev, { ...message, isOwn }];
            });
        };

        socket.on('chat:message', onChatMessage);

        return () => {
            socket.off('chat:message', onChatMessage);
        };
    }, [username]);

    const sendMessage = useCallback((text: string) => {
        if (!text.trim()) return;
        socketService.getSocket().emit('chat:send', {
            text: text.trim(),
        });
    }, []);


    return { messages, sendMessage };
}
