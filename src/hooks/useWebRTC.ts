import { useEffect, useRef, useState, useCallback } from 'react';
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
        let cleanupSocket: (() => void) | undefined;

        const onParticipants = (list: RoomParticipant[]) => {
            if (!isMounted) return;
            setParticipants(list);
            list.forEach((p) => {
                webRTCService.callParticipant(p.socketId).catch(() => {});
            });
        };

        const onUserJoined = (p: RoomParticipant) => {
            if (!isMounted) return;
            setParticipants((prev) => {
                if (prev.some((existing) => existing.socketId === p.socketId)) return prev;
                return [...prev, p];
            });
            // Initier l'appel WebRTC vers le nouveau participant
            webRTCService.callParticipant(p.socketId).catch(() => {});
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
            if (!offer.sdp) return;
            webRTCService
                .handleOffer(from, { type: offer.type as 'offer', sdp: offer.sdp })
                .catch(() => {});
        };

        const onAnswer = ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
            if (!answer.sdp) return;
            webRTCService
                .handleAnswer(from, { type: answer.type as 'answer', sdp: answer.sdp })
                .catch(() => {});
        };

        const onIceCandidate = ({
            from,
            candidate,
        }: {
            from: string;
            candidate: RTCIceCandidateInit;
        }) => {
            webRTCService.handleIceCandidate(from, candidate).catch(() => {});
        };

        (async () => {
            try {
                const stream = await webRTCService.getLocalStream();
                if (!isMounted) return;
                setLocalStream(stream);

                socketService.connect();
                await socketService.waitForConnect();
                if (!isMounted) return;

                const socket = socketService.getSocket();
                const unsubStream = webRTCService.onRemoteStream((entry: RemoteStreamEntry) => {
                    if (!isMounted) return;
                    setRemoteStreams((prev) => [
                        ...prev.filter((s) => s.socketId !== entry.socketId),
                        entry,
                    ]);
                });
                const unsubStreamRemoved = webRTCService.onRemoteStreamRemoved((socketId: string) => {
                    if (!isMounted) return;
                    setRemoteStreams((prev) => prev.filter((s) => s.socketId !== socketId));
                });

                socket.on('room:participants', onParticipants);
                socket.on('room:user-joined', onUserJoined);
                socket.on('room:user-left', onUserLeft);
                socket.on('room:error', onRoomError);
                socket.on('webrtc:offer', onOffer);
                socket.on('webrtc:answer', onAnswer);
                socket.on('webrtc:ice-candidate', onIceCandidate);

                socketService.joinRoom(roomId, username, isHost);

                cleanupSocket = () => {
                    unsubStream();
                    unsubStreamRemoved();
                    socket.off('room:participants', onParticipants);
                    socket.off('room:user-joined', onUserJoined);
                    socket.off('room:user-left', onUserLeft);
                    socket.off('room:error', onRoomError);
                    socket.off('webrtc:offer', onOffer);
                    socket.off('webrtc:answer', onAnswer);
                    socket.off('webrtc:ice-candidate', onIceCandidate);
                };
            } catch (error) {
                if (!isMounted) return;
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Une erreur est survenue en rejoignant la réunion.';
                setJoinError(message);
            }
        })();

        return () => {
            isMounted = false;
            cleanupSocket?.();
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
