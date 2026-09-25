import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DRAWING_COLORS, STROKE_WIDTHS } from '@/utils/constants';
import { colors, spacing, radius } from '@/theme';

interface ToolBarProps {
    currentColor: string;
    currentWidth: number;
    isEraser: boolean;
    isHost: boolean;
    onSelectColor: (color: string) => void;
    onSelectWidth: (width: number) => void;
    onToggleEraser: () => void;
    onClearAll: () => void;
}

export default function ToolBar({
    currentColor,
    currentWidth,
    isEraser,
    isHost,
    onSelectColor,
    onSelectWidth,
    onToggleEraser,
    onClearAll,
}: ToolBarProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.sm }]}>
            <View style={styles.row}>
                {DRAWING_COLORS.map((color) => (
                    <TouchableOpacity
                        key={color}
                        onPress={() => onSelectColor(color)}
                        style={[
                            styles.colorDot,
                            { backgroundColor: color },
                            !isEraser && currentColor === color && styles.colorDotActive,
                        ]}
                    />
                ))}
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
                {STROKE_WIDTHS.map((width) => (
                    <TouchableOpacity
                        key={width}
                        onPress={() => onSelectWidth(width)}
                        style={[styles.widthButton, currentWidth === width && styles.widthButtonActive]}
                    >
                        <View
                            style={{
                                width: width + 4,
                                height: width + 4,
                                borderRadius: (width + 4) / 2,
                                backgroundColor: currentWidth === width ? '#fff' : colors.text,
                            }}
                        />
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
                style={[styles.toolButton, isEraser && styles.toolButtonActive]}
                onPress={onToggleEraser}
            >
                <Ionicons name="backspace-outline" size={18} color={isEraser ? '#fff' : colors.text} />
            </TouchableOpacity>

            {isHost && (
                <TouchableOpacity style={styles.clearButton} onPress={onClearAll}>
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                    <Text style={styles.clearText}>Tout effacer</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    colorDot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        marginRight: spacing.xs,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorDotActive: {
        borderColor: colors.primary,
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: colors.border,
        marginHorizontal: spacing.xs,
    },
    widthButton: {
        width: 30,
        height: 30,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.xs,
    },
    widthButtonActive: {
        backgroundColor: colors.primary,
    },
    toolButton: {
        width: 36,
        height: 36,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceLight,
    },
    toolButtonActive: {
        backgroundColor: colors.primary,
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.danger,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: radius.sm,
    },
    clearText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
});
