import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Text } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';
import { RootStackParamList } from '@/navigation/types';
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
    const route = useRoute<RouteProp<RootStackParamList, 'MeetingRoom'>>();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const insets = useSafeAreaInsets();
    const { roomId, username, isHost: initialIsHost } = route.params;
    const [mode, setMode] = useState<ViewMode>('video');
    const [unreadChat, setUnreadChat] = useState(0);

    const {
        localStream, remoteStreams, participants,
        isMicOn, isCamOn, isFrontCam, isScreenSharing,
        toggleMic, toggleCam, flipCamera, toggleScreenShare, leaveRoom, joinError, isHost, isReconnecting,
    } = useWebRTC(roomId, username, initialIsHost);

    const {
        strokes,
        currentColor, currentWidth, isEraser,
        setCurrentColor, setCurrentWidth, setIsEraser,
        startStroke, addPoint, endStroke, clearBoard,
    } = useDrawing(roomId, username);

    const { messages, sendMessage } = useChat(roomId, username);
    const { raisedHands, isHandRaised, toggleHand } = useRaisedHand(roomId);

    // Notification messages non lus — badge visible dans tous les modes sauf 'chat'
    const prevMessagesLen = useRef(messages.length);
    useEffect(() => {
        if (messages.length > prevMessagesLen.current && mode !== 'chat') {
            setUnreadChat((c) => c + 1);
        }
        prevMessagesLen.current = messages.length;
    }, [messages.length, mode]);

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

    const handleLeave = () => {
        leaveRoom();
        // Laisse le temps au socket de traiter la déconnexion avant navigation
        setTimeout(() => navigation.goBack(), 100);
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

            {isReconnecting && (
                <View style={styles.reconnectBanner}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.reconnectText}>Connexion perdue — reconnexion en cours…</Text>
                </View>
            )}

            <View style={styles.content}>
                {/* Chargement pendant l'acquisition caméra/micro + connexion */}
                {!localStream && !joinError && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Connexion en cours…</Text>
                    </View>
                )}
                {/*
                 * Ne jamais utiliser display:'none' sur les RTCView (SurfaceView Android) :
                 * ça fait crasher l'APK. On réduit la couche vidéo à 1×1 hors mode visio.
                 * Un seul LocalVideo : deux RTCView sur le même stream plantent aussi.
                 */}
                <View style={mode === 'video' ? styles.videoLayer : styles.videoLayerMinimized}>
                    <RaisedHandsBar raisedHands={raisedHands} />
                    <VideoGrid remoteStreams={remoteStreams} participants={participants} />
                </View>

                {mode === 'whiteboard' && (
                    <View style={styles.overlayLayer}>
                        <CanvasView
                            strokes={strokes}
                            onStart={startStroke}
                            onMove={addPoint}
                            onEnd={endStroke}
                        />
                        <ToolBar
                            currentColor={currentColor}
                            currentWidth={currentWidth}
                            isEraser={isEraser}
                            isHost={isHost}
                            onSelectColor={setCurrentColor}
                            onSelectWidth={setCurrentWidth}
                            onToggleEraser={() => setIsEraser(!isEraser)}
                            onClearAll={handleClearAll}
                        />
                    </View>
                )}

                {mode === 'chat' && (
                    <View style={styles.overlayLayer}>
                        <ChatPanel messages={messages} username={username} onSend={sendMessage} />
                    </View>
                )}

                <View style={styles.localVideoOverlay} pointerEvents="none">
                    <LocalVideo
                        stream={localStream}
                        isCamOn={isCamOn}
                        isFrontCam={isFrontCam}
                        username={isHost ? `${username} (hôte)` : username}
                    />
                </View>
            </View>

            <ControlBar
                isMicOn={isMicOn}
                isCamOn={isCamOn}
                isHandRaised={isHandRaised}
                isFrontCam={isFrontCam}
                isScreenSharing={isScreenSharing}
                onToggleMic={toggleMic}
                onToggleCam={toggleCam}
                onToggleHand={toggleHand}
                onFlipCamera={flipCamera}
                onToggleScreenShare={toggleScreenShare}
                onLeave={handleLeave}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1 },
    reconnectBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#2F3136',
        paddingVertical: 8,
        marginHorizontal: spacing.md,
        borderRadius: radius.full,
        marginBottom: 4,
    },
    reconnectText: { color: colors.text, fontSize: 12, fontWeight: '600' },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        zIndex: 5,
    },
    loadingText: { color: colors.textMuted, fontSize: 13 },
    videoLayer: { flex: 1 },
    videoLayerMinimized: {
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
        overflow: 'hidden',
    },
    overlayLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.background,
        zIndex: 1,
    },
    localVideoOverlay: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 2,
    },
});
