import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useDrawing } from '@/hooks/useDrawing';
import { useChat } from '@/hooks/useChat';
import { useRaisedHand } from '@/hooks/useRaisedHand';
import VideoGrid from '@/components/video/VideoGrid';
import LocalVideo from '@/components/video/LocalVideo';
import ControlBar from '@/components/video/ControlBar';
import RaisedHandsBar from '@/components/video/RaisedHandsBar';
import CanvasView from '@/components/whiteboard/CanvasView';
import ToolBar from '@/components/whiteboard/ToolBar';
import ChatPanel from '@/components/chat/ChatPanel';
import SharedControls, { ViewMode } from '@/components/SharedControls';

export default function MeetingRoomScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { roomId, username, isHost } = route.params;
    const [mode, setMode] = useState<ViewMode>('video');
    const [unreadChat, setUnreadChat] = useState(0);

    const {
        localStream, remoteStreams, participants,
        isMicOn, isCamOn, toggleMic, toggleCam, leaveRoom, joinError,
    } = useWebRTC(roomId, username, isHost);

    const {
        strokes,
        currentColor, currentWidth, isEraser,
        canDraw, hasPendingRequest, pendingDrawRequest,
        setCurrentColor, setCurrentWidth, setIsEraser,
        startStroke, addPoint, endStroke, clearBoard,
        requestDrawPermission, allowDraw, denyDraw,
    } = useDrawing(username, isHost);

    const { messages, sendMessage } = useChat(roomId, username);
    const { raisedHands, isHandRaised, toggleHand } = useRaisedHand(roomId);

    // Notification messages non lus
    useEffect(() => {
        if (mode !== 'chat' && messages.length > 0) {
            setUnreadChat((c) => c + 1);
        }
    }, [messages.length]);

    useEffect(() => {
        if (mode === 'chat') setUnreadChat(0);
    }, [mode]);

    // Erreur de connexion
    useEffect(() => {
        if (joinError) {
            Alert.alert('Impossible de rejoindre', joinError, [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        }
    }, [joinError]);

    // L'hôte reçoit une demande de dessin → alerte avec Autoriser / Refuser
    useEffect(() => {
        if (!isHost || !pendingDrawRequest) return;
        Alert.alert(
            'Demande de dessin',
            `${pendingDrawRequest.username} souhaite dessiner sur le tableau.`,
            [
                {
                    text: 'Refuser',
                    style: 'destructive',
                    onPress: () => denyDraw(pendingDrawRequest.socketId),
                },
                {
                    text: 'Autoriser',
                    onPress: () => allowDraw(pendingDrawRequest.socketId),
                },
            ],
            { cancelable: false }
        );
    }, [pendingDrawRequest]);

    const handleLeave = () => {
        leaveRoom();
        navigation.goBack();
    };

    const handleClearAll = () => {
        Alert.alert(
            'Effacer tout le tableau ?',
            'Cette action supprime tous les tracés pour tous les participants.',
            [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Tout effacer', style: 'destructive', onPress: clearBoard },
            ]
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <SharedControls mode={mode} onChangeMode={setMode} unreadCount={unreadChat} />

            <View style={styles.content}>
                {mode === 'video' && (
                    <>
                        <RaisedHandsBar raisedHands={raisedHands} />
                        <VideoGrid remoteStreams={remoteStreams} participants={participants} />
                        <View style={styles.localVideoOverlay}>
                            <LocalVideo
                                stream={localStream}
                                isCamOn={isCamOn}
                                username={isHost ? `${username} (hôte)` : username}
                            />
                        </View>
                    </>
                )}

                {mode === 'whiteboard' && (
                    <>
                        <CanvasView
                            strokes={strokes}
                            canDraw={canDraw}
                            onStart={startStroke}
                            onMove={addPoint}
                            onEnd={endStroke}
                        />
                        <ToolBar
                            currentColor={currentColor}
                            currentWidth={currentWidth}
                            isEraser={isEraser}
                            isHost={isHost}
                            canDraw={canDraw}
                            hasPendingRequest={hasPendingRequest}
                            onSelectColor={setCurrentColor}
                            onSelectWidth={setCurrentWidth}
                            onToggleEraser={() => setIsEraser(!isEraser)}
                            onClearAll={handleClearAll}
                            onRequestDraw={() => requestDrawPermission(roomId)}
                        />
                    </>
                )}

                {mode === 'chat' && (
                    <ChatPanel messages={messages} username={username} onSend={sendMessage} />
                )}
            </View>

            <ControlBar
                isMicOn={isMicOn}
                isCamOn={isCamOn}
                isHandRaised={isHandRaised}
                onToggleMic={toggleMic}
                onToggleCam={toggleCam}
                onToggleHand={toggleHand}
                onLeave={handleLeave}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1 },
    localVideoOverlay: { position: 'absolute', bottom: 16, right: 16 },
});
