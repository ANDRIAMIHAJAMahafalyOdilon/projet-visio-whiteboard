import React from 'react';
import { View, StyleSheet, Text, FlatList } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { RemoteStreamEntry } from '@/services/webRTCService';
import { RoomParticipant } from '@/services/socketService';
import { colors, radius, spacing } from '@/theme';

interface VideoGridProps {
    remoteStreams: RemoteStreamEntry[];
    participants: RoomParticipant[];
}

export default function VideoGrid({ remoteStreams, participants }: VideoGridProps) {
    const getUsername = (socketId: string) =>
        participants.find((p) => p.socketId === socketId)?.username ?? 'Participant';

    if (remoteStreams.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>En attente d'autres participants…</Text>
            </View>
        );
    }

    return (
        <FlatList
            data={remoteStreams}
            keyExtractor={(item) => item.socketId}
            numColumns={2}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
                <View style={styles.tile}>
                    <RTCView streamURL={item.stream.toURL()} style={styles.video} objectFit="cover" zOrder={0} />
                    <View style={styles.label}>
                        <Text style={styles.labelText}>{getUsername(item.socketId)}</Text>
                    </View>
                </View>
            )}
        />
    );
}

const styles = StyleSheet.create({
    grid: { padding: spacing.xs },
    tile: {
        flex: 1,
        aspectRatio: 1,
        margin: spacing.xs,
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: colors.surfaceLight,
    },
    video: { flex: 1 },
    label: {
        position: 'absolute',
        bottom: 4,
        left: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 6,
        paddingVertical: 2,
    },
    labelText: { color: '#fff', fontSize: 10, textAlign: 'center' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: colors.textMuted, fontSize: 13 },
});