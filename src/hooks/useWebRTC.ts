import { useEffect, useState, useCallback } from 'react';
import { MediaStream } from 'react-native-webrtc';
import { socketService, RoomParticipant } from '@/services/socketService';
import { webRTCService, RemoteStreamEntry } from '@/services/webRTCService';

interface UseWebRTCResult {
    localStream: MediaStream | null;
    remoteStreams: RemoteStreamEntry[];
    participants: RoomParticipant[];
    isMicOn: boolean;
    isCamOn: boolean;
    toggleMic: () => void;
    toggleCam: () => void;
    leaveRoom: () => void;
    joinError: string | null;
}

export function useWebRTC(roomId: string, username: string, isHost: boolean): UseWebRTCResult {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<RemoteStreamEntry[]>([]);
    const [participants, setParticipants] = useState<RoomParticipant[]>([]);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);
    const [joinError, setJoinError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const cleanupRefs: (() => void)[] = [];

        // Le participant qui rejoint est "poli" (cède en cas de collision d'offers)
        // L'hôte est "impoli" (prioritaire)
        webRTCService.setPolite(!isHost);

        const onRemoteStream = (entry: RemoteStreamEntry) => {
            if (!isMounted) return;
            setRemoteStreams((prev) => [
                ...prev.filter((s) => s.socketId !== entry.socketId),
                entry,
            ]);
        };

        const onRemoteStreamRemoved = (socketId: string) => {
            if (!isMounted) return;
            setRemoteStreams((prev) => prev.filter((s) => s.socketId !== socketId));
        };

        const onParticipants = (list: RoomParticipant[]) => {
            if (!isMounted) return;
            setParticipants(list);
            list.forEach((p) => {
                webRTCService.callParticipant(p.socketId).catch(console.warn);
            });
        };

        const onUserJoined = (p: RoomParticipant) => {
            if (!isMounted) return;
            setParticipants((prev) => {
                if (prev.some((e) => e.socketId === p.socketId)) return prev;
                return [...prev, p];
            });
            webRTCService.callParticipant(p.socketId).catch(console.warn);
        };

        const onUserLeft = (socketId: string) => {
            if (!isMounted) return;
            setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
            webRTCService.removeParticipant(socketId);
        };

        const onRoomError = ({ message }: { message: string }) => {
            if (!isMounted) return;
            setJoinError(message);
        };

        const onOffer = ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
            if (!offer.sdp || !isMounted) return;
            webRTCService.handleOffer(from, { type: 'offer', sdp: offer.sdp }).catch(console.warn);
        };

        const onAnswer = ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
            if (!answer.sdp || !isMounted) return;
            webRTCService.handleAnswer(from, { type: 'answer', sdp: answer.sdp }).catch(console.warn);
        };

        const onIceCandidate = ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
            if (!isMounted) return;
            webRTCService.handleIceCandidate(from, candidate).catch(console.warn);
        };

        const setupSocketListeners = () => {
            const socket = socketService.getSocket();
            socket.on('room:participants', onParticipants);
            socket.on('room:user-joined', onUserJoined);
            socket.on('room:user-left', onUserLeft);
            socket.on('room:error', onRoomError);
            socket.on('webrtc:offer', onOffer);
            socket.on('webrtc:answer', onAnswer);
            socket.on('webrtc:ice-candidate', onIceCandidate);

            const handleReconnect = () => {
                console.log('Reconnection detected, re-joining room...');
                socketService.joinRoom(roomId, username, isHost);
            };
            socket.on('connect', handleReconnect);

            return () => {
                socket.off('room:participants', onParticipants);
                socket.off('room:user-joined', onUserJoined);
                socket.off('room:user-left', onUserLeft);
                socket.off('room:error', onRoomError);
                socket.off('webrtc:offer', onOffer);
                socket.off('webrtc:answer', onAnswer);
                socket.off('webrtc:ice-candidate', onIceCandidate);
                socket.off('connect', handleReconnect);
            };
        };

        (async () => {
            try {
                const stream = await webRTCService.getLocalStream();
                if (!isMounted) return;
                setLocalStream(stream);

                socketService.connect();
                await socketService.waitForConnect();
                if (!isMounted) return;

                cleanupRefs.push(webRTCService.onRemoteStream(onRemoteStream));
                cleanupRefs.push(webRTCService.onRemoteStreamRemoved(onRemoteStreamRemoved));
                cleanupRefs.push(setupSocketListeners());

                socketService.joinRoom(roomId, username, isHost);
            } catch (error) {
                if (!isMounted) return;
                setJoinError(error instanceof Error ? error.message : 'Erreur de connexion.');
            }
        })();

        return () => {
            isMounted = false;
            cleanupRefs.forEach(c => c());
        };
    }, [roomId, username, isHost]);


    const toggleMic = useCallback(() => {
        setIsMicOn((prev) => {
            webRTCService.toggleAudio(!prev);
            return !prev;
        });
    }, []);

    const toggleCam = useCallback(() => {
        setIsCamOn((prev) => {
            webRTCService.toggleVideo(!prev);
            return !prev;
        });
    }, []);

    const leaveRoom = useCallback(() => {
        webRTCService.cleanup();
        socketService.disconnect();
    }, []);

    return {
        localStream,
        remoteStreams,
        participants,
        isMicOn,
        isCamOn,
        toggleMic,
        toggleCam,
        leaveRoom,
        joinError,
    };
}
