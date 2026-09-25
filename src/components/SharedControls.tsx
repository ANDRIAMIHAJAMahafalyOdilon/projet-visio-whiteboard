import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';

export type ViewMode = 'video' | 'whiteboard' | 'chat';

interface SharedControlsProps {
    mode: ViewMode;
    onChangeMode: (mode: ViewMode) => void;
    unreadCount?: number;
}

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { key: ViewMode; label: string; icon: IoniconName }[] = [
    { key: 'video', label: 'Visio', icon: 'videocam' },
    { key: 'whiteboard', label: 'Tableau', icon: 'brush' },
    { key: 'chat', label: 'Chat', icon: 'chatbubble' },
];

export default function SharedControls({ mode, onChangeMode, unreadCount = 0 }: SharedControlsProps) {
    return (
        <View style={styles.container}>
            {TABS.map((tab) => (
                <TouchableOpacity
                    key={tab.key}
                    style={[styles.tab, mode === tab.key && styles.tabActive]}
                    onPress={() => onChangeMode(tab.key)}
                >
                    <Ionicons name={tab.icon} size={18} color={mode === tab.key ? '#fff' : colors.textMuted} />
                    <Text style={[styles.tabText, mode === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                    {tab.key === 'chat' && unreadCount > 0 && (
                        <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>
                    )}
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.full, padding: 4, margin: spacing.sm, alignSelf: 'center' },
    tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full },
    tabActive: { backgroundColor: colors.primary },
    tabText: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginLeft: 6 },
    tabTextActive: { color: '#fff' },
    badge: { position: 'absolute', top: -2, right: -2, backgroundColor: colors.danger, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
    badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});