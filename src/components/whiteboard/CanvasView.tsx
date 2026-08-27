import React, { useRef, useMemo } from 'react';
import { View, StyleSheet, PanResponder, GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Stroke, pointsToSvgPath } from '@/utils/drawUtils';
import { colors } from '@/theme';

interface CanvasViewProps {
    strokes: Stroke[];
    onStart: (point: { x: number; y: number }) => void;
    onMove: (point: { x: number; y: number }) => void;
    onEnd: () => void;
}

export default function CanvasView({ strokes, onStart, onMove, onEnd }: CanvasViewProps) {
    const activeTouches = useRef(0);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: (evt: GestureResponderEvent) => {
                    activeTouches.current++;
                    if (activeTouches.current === 1) {
                        const { locationX, locationY } = evt.nativeEvent;
                        onStart({ x: locationX, y: locationY });
                    }
                },
                onPanResponderMove: (evt: GestureResponderEvent) => {
                    if (activeTouches.current === 1) {
                        const { locationX, locationY } = evt.nativeEvent;
                        onMove({ x: locationX, y: locationY });
                    }
                },
                onPanResponderRelease: () => {
                    activeTouches.current = Math.max(0, activeTouches.current - 1);
                    if (activeTouches.current === 0) onEnd();
                },
                onPanResponderTerminate: () => {
                    activeTouches.current = Math.max(0, activeTouches.current - 1);
                    if (activeTouches.current === 0) onEnd();
                },
            }),
        [onStart, onMove, onEnd]
    );

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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.canvasBg,
    },
});
