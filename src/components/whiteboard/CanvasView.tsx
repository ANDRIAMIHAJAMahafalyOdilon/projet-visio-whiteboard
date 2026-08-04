import React, { useRef } from 'react';
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
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt: GestureResponderEvent) => {
                const { locationX, locationY } = evt.nativeEvent;
                onStart({ x: locationX, y: locationY });
            },
            onPanResponderMove: (evt: GestureResponderEvent) => {
                const { locationX, locationY } = evt.nativeEvent;
                onMove({ x: locationX, y: locationY });
            },
            onPanResponderRelease: () => onEnd(),
            onPanResponderTerminate: () => onEnd(),
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.canvasBg,
    },
});
