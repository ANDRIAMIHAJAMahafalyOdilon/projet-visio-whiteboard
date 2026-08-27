import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { RTCView, MediaStream } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/theme';

interface LocalVideoProps {
    stream: MediaStream | null;
    isCamOn: boolean;
    isFrontCam: boolean;
    username: string;
}

export default function LocalVideo({ stream, isCamOn, isFrontCam, username }: LocalVideoProps) {
    return (
        <View style={styles.container}>
            {stream && isCamOn ? (
                <RTCView streamURL={stream.toURL()} style={styles.video} objectFit="cover" mirror={isFrontCam} />
            ) : (
                <View style={styles.placeholder}>
                    <Ionicons name="person" size={28} color={colors.textMuted} />
                </View>
            )}
            <View style={styles.label}>
                <Text style={styles.labelText}>{username} (moi)</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 100,
        height: 140,
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: colors.surfaceLight,
        borderWidth: 2,
        borderColor: colors.primary,
    },
    video: { flex: 1 },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        position: 'absolute',
        bottom: 4,
        left: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 6,
        paddingVertical: 2,
    },
    labelText: {
        color: '#fff',
        fontSize: 9,
        textAlign: 'center',
    },
});