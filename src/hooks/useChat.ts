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

        // Handler nommé obligatoire pour que socket.off retire uniquement CE listener
        const onChatMessage = (message: ChatMessage) => {
            setMessages((prev) => {
                // Éviter les doublons si le message est déjà présent
                if (prev.some((m) => m.id === message.id)) return prev;
                return [...prev, message];
            });
        };

        socket.on('chat:message', onChatMessage);

        return () => {
            socket.off('chat:message', onChatMessage);
        };
    }, []);

    const sendMessage = useCallback((text: string) => {
        if (!text.trim()) return;
        socketService.getSocket().emit('chat:send', {
            roomId,
            sender: username,
            text: text.trim(),
        });
    }, [roomId, username]);

    return { messages, sendMessage };
}
