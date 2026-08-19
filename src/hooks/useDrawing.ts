import { useState, useCallback, useRef, useEffect } from 'react';
import { socketService } from '@/services/socketService';
import { ERASER_COLOR } from '@/utils/constants';
import { Point, Stroke, generateId, simplifyPoints } from '@/utils/drawUtils';

interface UseDrawingResult {
    strokes: Stroke[];
    currentColor: string;
    currentWidth: number;
    isEraser: boolean;
    setCurrentColor: (color: string) => void;
    setCurrentWidth: (width: number) => void;
    setIsEraser: (enabled: boolean) => void;
    startStroke: (point: Point) => void;
    addPoint: (point: Point) => void;
    endStroke: () => void;
    clearBoard: () => void;
}

export function useDrawing(roomId: string, username: string): UseDrawingResult {
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentColor, setCurrentColorState] = useState('#000000');
    const [currentWidth, setCurrentWidthState] = useState(4);
    const [isEraser, setIsEraserState] = useState(false);

    const colorRef = useRef('#000000');
    const widthRef = useRef(4);
    const isEraserRef = useRef(false);
    const activeStrokeId = useRef<string | null>(null);
    const pointsBuffer = useRef<Point[]>([]);

    const setCurrentColor = useCallback((color: string) => {
        colorRef.current = color;
        isEraserRef.current = false;
        setCurrentColorState(color);
        setIsEraserState(false);
    }, []);

    const setCurrentWidth = useCallback((width: number) => {
        widthRef.current = width;
        setCurrentWidthState(width);
    }, []);

    const setIsEraser = useCallback((enabled: boolean) => {
        isEraserRef.current = enabled;
        setIsEraserState(enabled);
    }, []);

    useEffect(() => {
        const socket = socketService.getSocket();

        const onStrokeStart = (stroke: Stroke) => {
            setStrokes((prev) => {
                if (prev.some((s) => s.id === stroke.id)) return prev;
                return [...prev, stroke];
            });
        };

        const onStrokeUpdate = ({ id, points }: { id: string; points: Point[] }) => {
            setStrokes((prev) =>
                prev.map((s) => (s.id === id ? { ...s, points: [...s.points, ...points] } : s))
            );
        };

        const onClear = () => {
            setStrokes([]);
        };

        socket.on('whiteboard:stroke-start', onStrokeStart);
        socket.on('whiteboard:stroke-update', onStrokeUpdate);
        socket.on('whiteboard:clear', onClear);

        return () => {
            socket.off('whiteboard:stroke-start', onStrokeStart);
            socket.off('whiteboard:stroke-update', onStrokeUpdate);
            socket.off('whiteboard:clear', onClear);
        };
    }, []);

    const startStroke = useCallback(
        (point: Point) => {
            const id = generateId();
            activeStrokeId.current = id;
            pointsBuffer.current = [point];

            const erasing = isEraserRef.current;
            const stroke: Stroke = {
                id,
                points: [point],
                color: erasing ? ERASER_COLOR : colorRef.current,
                width: erasing ? Math.max(widthRef.current, 12) : widthRef.current,
                authorId: username,
            };

            setStrokes((prev) => [...prev, stroke]);
            socketService.getSocket().emit('whiteboard:stroke-start', { ...stroke, roomId });
        },
        [username, roomId]
    );

    const addPoint = useCallback((point: Point) => {
        if (!activeStrokeId.current) return;
        const id = activeStrokeId.current;

        setStrokes((prev) =>
            prev.map((s) => (s.id === id ? { ...s, points: [...s.points, point] } : s))
        );

        pointsBuffer.current.push(point);

        if (pointsBuffer.current.length >= 4) {
            const toSend = simplifyPoints(pointsBuffer.current);
            socketService.getSocket().emit('whiteboard:stroke-update', { id, points: toSend, roomId });
            pointsBuffer.current = [];
        }
    }, [roomId]);

    const endStroke = useCallback(() => {
        if (!activeStrokeId.current) return;
        const id = activeStrokeId.current;

        if (pointsBuffer.current.length > 0) {
            socketService.getSocket().emit('whiteboard:stroke-update', {
                id,
                points: pointsBuffer.current,
                roomId
            });
        }
        socketService.getSocket().emit('whiteboard:stroke-end', { id, roomId });

        activeStrokeId.current = null;
        pointsBuffer.current = [];
    }, [roomId]);

    const clearBoard = useCallback(() => {
        setStrokes([]);
        socketService.getSocket().emit('whiteboard:clear', { roomId });
    }, [roomId]);

    return {
        strokes,
        currentColor,
        currentWidth,
        isEraser,
        setCurrentColor,
        setCurrentWidth,
        setIsEraser,
        startStroke,
        addPoint,
        endStroke,
        clearBoard,
    };
}
