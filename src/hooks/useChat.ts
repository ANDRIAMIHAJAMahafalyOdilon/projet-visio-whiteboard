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
        socket.on('chat:message', (message: ChatMessage) => {
            setMessages((prev) => [...prev, message]);
        });
        return () => { socket.off('chat:message'); };
    }, []);

    const sendMessage = useCallback((text: string) => {
        if (!text.trim()) return;
        socketService.getSocket().emit('chat:send', { roomId, sender: username, text: text.trim() });
    }, [roomId, username]);

    return { messages, sendMessage };
}