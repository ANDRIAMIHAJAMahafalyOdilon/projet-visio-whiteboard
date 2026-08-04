import React, { useRef } from 'react';
import { View, StyleSheet, PanResponder, GestureResponderEvent, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Stroke, pointsToSvgPath } from '@/utils/drawUtils';
import { colors } from '@/theme';

interface CanvasViewProps {
    strokes: Stroke[];
    canDraw: boolean;
    onStart: (point: { x: number; y: number }) => void;
    onMove: (point: { x: number; y: number }) => void;
    onEnd: () => void;
}

export default function CanvasView({ strokes, canDraw, onStart, onMove, onEnd }: CanvasViewProps) {
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => canDraw,
            onMoveShouldSetPanResponder: () => canDraw,
            onPanResponderGrant: (evt: GestureResponderEvent) => {
                if (!canDraw) return;
                const { locationX, locationY } = evt.nativeEvent;
                onStart({ x: locationX, y: locationY });
            },
            onPanResponderMove: (evt: GestureResponderEvent) => {
                if (!canDraw) return;
                const { locationX, locationY } = evt.nativeEvent;
                onMove({ x: locationX, y: locationY });
            },
            onPanResponderRelease: () => { if (canDraw) onEnd(); },
            onPanResponderTerminate: () => { if (canDraw) onEnd(); },
        })
    ).current;

    return (
        <View style={styles.container} {...panResponder.panHandlers}>
            <Svg style={StyleSheet.absoluteFill}>
                {strokes.map((stroke) => (
                    <Path
                        key={stroke.id}
                        d={pointsToSvgPath(stroke.points)}
                        stroke={stroke.color}
                        strokeWidth={stroke.width}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                ))}
            </Svg>
            {!canDraw && (
                <View style={styles.lockedOverlay} pointerEvents="none">
                    <Text style={styles.lockedText}>🔒 Dessin verrouillé — demande la permission à l'hôte</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.canvasBg,
    },
    lockedOverlay: {
        position: 'absolute',
        bottom: 12,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    lockedText: {
        backgroundColor: 'rgba(0,0,0,0.55)',
        color: '#fff',
        fontSize: 13,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        overflow: 'hidden',
    },
});
