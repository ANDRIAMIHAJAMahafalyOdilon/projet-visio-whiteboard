import { useEffect, useState, useCallback, useRef } from 'react';
import { MediaStream } from 'react-native-webrtc';
import { socketService, RoomParticipant } from '@/services/socketService';
import { webRTCService, RemoteStreamEntry } from '@/services/webRTCService';

interface UseWebRTCResult {
    localStream: MediaStream | null;
    remoteStreams: RemoteStreamEntry[];
    participants: RoomParticipant[];
    isHost: boolean;
    isMicOn: boolean;
    isCamOn: boolean;
    isFrontCam: boolean;
    isScreenSharing: boolean;
    toggleMic: () => void;
    toggleCam: () => void;
    flipCamera: () => void;
    toggleScreenShare: () => Promise<void>;
    leaveRoom: () => void;
    joinError: string | null;
}

export function useWebRTC(roomId: string, username: string, isHost: boolean): UseWebRTCResult {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<RemoteStreamEntry[]>([]);
    const [participants, setParticipants] = useState<RoomParticipant[]>([]);
    const [isCurrentHost, setIsCurrentHost] = useState(isHost);
    const isHostRef = useRef(isHost);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);
    const [isFrontCam, setIsFrontCam] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const cleanupRefs: (() => void)[] = [];

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

        const onYouAreHost = () => {
            if (!isMounted) return;
            isHostRef.current = true;
            setIsCurrentHost(true);
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
            socket.on('room:you-are-host', onYouAreHost);
            socket.on('webrtc:offer', onOffer);
            socket.on('webrtc:answer', onAnswer);
            socket.on('webrtc:ice-candidate', onIceCandidate);

            // 'reconnect' (pas 'connect') : se déclenche uniquement après une
            // VRAIE reconnexion, pas à la première connexion initiale
            const handleReconnect = () => {
                console.log('[SOCKET] Reconnexion — re-join room...');
                webRTCService.cleanupPeerConnections();
                setRemoteStreams([]);
                setParticipants([]);
                socketService.joinRoom(roomId, username, isHostRef.current);
            };
            socket.io.on('reconnect', handleReconnect);

            return () => {
                socket.off('room:participants', onParticipants);
                socket.off('room:user-joined', onUserJoined);
                socket.off('room:user-left', onUserLeft);
                socket.off('room:error', onRoomError);
                socket.off('room:you-are-host', onYouAreHost);
                socket.off('webrtc:offer', onOffer);
                socket.off('webrtc:answer', onAnswer);
                socket.off('webrtc:ice-candidate', onIceCandidate);
                socket.io.off('reconnect', handleReconnect);
            };
        };

        (async () => {
            try {
                const stream = await webRTCService.getLocalStream();
                if (!isMounted) {
                    webRTCService.cleanup();
                    socketService.disconnect();
                    return;
                }
                setLocalStream(stream);

                socketService.connect();
                await socketService.waitForConnect();
                if (!isMounted) return;

                cleanupRefs.push(webRTCService.onRemoteStream(onRemoteStream));
                cleanupRefs.push(webRTCService.onRemoteStreamRemoved(onRemoteStreamRemoved));
                cleanupRefs.push(setupSocketListeners());
                cleanupRefs.push(webRTCService.onScreenShareEnded(() => {
                    if (isMounted) setIsScreenSharing(false);
                }));

                socketService.joinRoom(roomId, username, isHost);
            } catch (error) {
                if (!isMounted) return;
                setJoinError(error instanceof Error ? error.message : 'Erreur de connexion.');
            }
        })();

        return () => {
            isMounted = false;
            cleanupRefs.forEach(c => c());
            webRTCService.cleanup();
            socketService.disconnect();
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

    const flipCamera = useCallback(() => {
        webRTCService.flipCamera();
        setIsFrontCam((prev) => !prev);
    }, []);

    const toggleScreenShare = useCallback(async () => {
        if (isScreenSharing) {
            await webRTCService.stopScreenShare();
            setIsScreenSharing(false);
        } else {
            try {
                await webRTCService.startScreenShare();
                setIsScreenSharing(true);
            } catch (e) {
                console.warn('Screen share failed:', e);
            }
        }
    }, [isScreenSharing]);

    const leaveRoom = useCallback(() => {
        webRTCService.cleanup();
        socketService.disconnect();
    }, []);

    return {
        localStream,
        remoteStreams,
        participants,
        isHost: isCurrentHost,
        isMicOn,
        isCamOn,
        isFrontCam,
        isScreenSharing,
        toggleMic,
        toggleCam,
        flipCamera,
        toggleScreenShare,
        leaveRoom,
        joinError,
    };
}
