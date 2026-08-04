import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { RaisedHandEntry } from '@/hooks/useRaisedHand';

export default function RaisedHandsBar({ raisedHands }: { raisedHands: RaisedHandEntry[] }) {
    if (raisedHands.length === 0) return null;
    return (
        <View style={styles.container}>
            {raisedHands.map((entry) => (
                <View key={entry.socketId} style={styles.chip}>
                    <Text style={styles.emoji}>✋</Text>
                    <Text style={styles.name}>{entry.username}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { position: 'absolute', top: spacing.sm, left: spacing.sm, right: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    emoji: { fontSize: 14, marginRight: 4 },
    name: { color: '#fff', fontSize: 11, fontWeight: '600' },
});