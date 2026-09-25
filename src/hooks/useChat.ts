import { useState, useEffect, useCallback } from 'react';
import { socketService, ChatMessagePayload } from '@/services/socketService';

export interface ChatMessage extends ChatMessagePayload {
    /** true si ce message a été envoyé par l'utilisateur local */
    isOwn: boolean;
}

export function useChat(roomId: string, username: string) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    useEffect(() => {
        const socket = socketService.getSocket();

        const onChatMessage = (message: ChatMessagePayload) => {
            setMessages((prev) => {
                if (prev.some((m) => m.id === message.id)) return prev;
                const isOwn = message.senderId === socket.id;
                return [...prev, { ...message, isOwn }];
            });
        };

        // Historique envoyé par le serveur à l'arrivée dans la salle
        const onChatHistory = (history: ChatMessagePayload[]) => {
            setMessages(history.map((m) => ({ ...m, isOwn: m.senderId === socket.id })));
        };

        socket.on('chat:message', onChatMessage);
        socket.on('chat:history', onChatHistory);

        return () => {
            socket.off('chat:message', onChatMessage);
            socket.off('chat:history', onChatHistory);
        };
    }, []);

    const sendMessage = useCallback((text: string) => {
        if (!text.trim()) return;
        socketService.getSocket().emit('chat:send', {
            text: text.trim(),
        });
    }, []);


    return { messages, sendMessage };
}
