import React, { useState, useEffect, useRef } from 'react';
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
    const { roomId, username, isHost: initialIsHost } = route.params;
    const [mode, setMode] = useState<ViewMode>('video');
    const [unreadChat, setUnreadChat] = useState(0);

    const {
        localStream, remoteStreams, participants,
        isMicOn, isCamOn, isFrontCam, isScreenSharing,
        toggleMic, toggleCam, flipCamera, toggleScreenShare, leaveRoom, joinError, isHost,
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

            <View style={styles.content}>
                {/*
                 * VideoGrid et LocalVideo sont TOUJOURS montés pour éviter de couper/recréer
                 * les streams WebRTC. On les cache avec display:'none' hors du mode vidéo.
                 */}
                <View style={mode === 'video' ? styles.videoContainer : styles.hidden}>
                    <RaisedHandsBar raisedHands={raisedHands} />
                    <VideoGrid remoteStreams={remoteStreams} participants={participants} />
                    <View style={styles.localVideoOverlay}>
                        <LocalVideo
                            stream={localStream}
                            isCamOn={isCamOn}
                            isFrontCam={isFrontCam}
                            username={isHost ? `${username} (hôte)` : username}
                        />
                    </View>
                </View>

                {mode === 'whiteboard' && (
                    <>
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
                    </>
                )}

                {mode === 'chat' && (
                    <ChatPanel messages={messages} username={username} onSend={sendMessage} />
                )}

                {/* Mini vignette PiP : vidéo locale visible en coin lors du chat / tableau blanc */}
                {mode !== 'video' && localStream && isCamOn && (
                    <View style={styles.pipOverlay} pointerEvents="none">
                        <LocalVideo
                            stream={localStream}
                            isCamOn={isCamOn}
                            isFrontCam={isFrontCam}
                            username={isHost ? `${username} (hôte)` : username}
                        />
                    </View>
                )}
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
    /** Conteneur plein écran pour le mode vidéo */
    videoContainer: { flex: 1 },
    /** Cache complètement le composant (display:none) sans le démonter */
    hidden: { display: 'none' },
    /** Vignette locale flottante en bas à droite (PiP) dans les autres modes */
    pipOverlay: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 10,
    },
    localVideoOverlay: { position: 'absolute', bottom: 16, right: 16 },
});
