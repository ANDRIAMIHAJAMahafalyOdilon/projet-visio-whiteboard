import { useState, useCallback, useRef, useEffect } from 'react';
import { socketService } from '@/services/socketService';
import { ERASER_COLOR } from '@/utils/constants';
import { Point, Stroke, generateId, simplifyPoints } from '@/utils/drawUtils';

interface DrawRequest {
    socketId: string;
    username: string;
}

interface UseDrawingResult {
    strokes: Stroke[];
    currentColor: string;
    currentWidth: number;
    isEraser: boolean;
    canDraw: boolean;
    hasPendingRequest: boolean;
    pendingDrawRequest: DrawRequest | null;
    setCurrentColor: (color: string) => void;
    setCurrentWidth: (width: number) => void;
    setIsEraser: (enabled: boolean) => void;
    startStroke: (point: Point) => void;
    addPoint: (point: Point) => void;
    endStroke: () => void;
    clearBoard: () => void;
    requestDrawPermission: (roomId: string) => void;
    allowDraw: (targetSocketId: string) => void;
    denyDraw: (targetSocketId: string) => void;
}

export function useDrawing(username: string, isHost: boolean): UseDrawingResult {
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentColor, setCurrentColorState] = useState('#000000');
    const [currentWidth, setCurrentWidthState] = useState(4);
    const [isEraser, setIsEraserState] = useState(false);
    // L'hôte peut toujours dessiner, les participants doivent demander
    const [canDraw, setCanDraw] = useState(isHost);
    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const [pendingDrawRequest, setPendingDrawRequest] = useState<DrawRequest | null>(null);

    const colorRef = useRef('#000000');
    const widthRef = useRef(4);
    const isEraserRef = useRef(false);
    const activeStrokeId = useRef<string | null>(null);
    const pointsBuffer = useRef<Point[]>([]);
    // Ref miroir de canDraw pour que startStroke lise toujours la valeur actuelle
    const canDrawRef = useRef(isHost);

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
            setStrokes((prev) => [...prev, stroke]);
        };

        const onStrokeUpdate = ({ id, points }: { id: string; points: Point[] }) => {
            setStrokes((prev) =>
                prev.map((s) => (s.id === id ? { ...s, points: [...s.points, ...points] } : s))
            );
        };

        const onClear = () => {
            setStrokes([]);
        };

        // Reçu par l'hôte : un participant veut dessiner
        const onDrawRequest = (payload: DrawRequest) => {
            setPendingDrawRequest(payload);
        };

        // Reçu par le participant : l'hôte a accepté
        const onDrawGranted = () => {
            canDrawRef.current = true;
            setCanDraw(true);
            setHasPendingRequest(false);
        };

        // Reçu par le participant : l'hôte a refusé
        const onDrawDenied = () => {
            setHasPendingRequest(false);
        };

        socket.on('whiteboard:stroke-start', onStrokeStart);
        socket.on('whiteboard:stroke-update', onStrokeUpdate);
        socket.on('whiteboard:clear', onClear);
        socket.on('whiteboard:draw-request', onDrawRequest);
        socket.on('whiteboard:draw-granted', onDrawGranted);
        socket.on('whiteboard:draw-denied', onDrawDenied);

        return () => {
            socket.off('whiteboard:stroke-start', onStrokeStart);
            socket.off('whiteboard:stroke-update', onStrokeUpdate);
            socket.off('whiteboard:clear', onClear);
            socket.off('whiteboard:draw-request', onDrawRequest);
            socket.off('whiteboard:draw-granted', onDrawGranted);
            socket.off('whiteboard:draw-denied', onDrawDenied);
        };
    }, []);

    const startStroke = useCallback(
        (point: Point) => {
            // Utilise la ref pour lire la valeur à jour (évite la closure stale)
            if (!canDrawRef.current) return;
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
            socketService.getSocket().emit('whiteboard:stroke-start', stroke);
        },
        [username]
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
            socketService.getSocket().emit('whiteboard:stroke-update', { id, points: toSend });
            pointsBuffer.current = [];
        }
    }, []);

    const endStroke = useCallback(() => {
        if (!activeStrokeId.current) return;
        const id = activeStrokeId.current;

        if (pointsBuffer.current.length > 0) {
            socketService.getSocket().emit('whiteboard:stroke-update', {
                id,
                points: pointsBuffer.current,
            });
        }
        socketService.getSocket().emit('whiteboard:stroke-end', { id });

        activeStrokeId.current = null;
        pointsBuffer.current = [];
    }, []);

    const clearBoard = useCallback(() => {
        setStrokes([]);
        socketService.getSocket().emit('whiteboard:clear');
    }, []);

    // Participant envoie une demande de permission à l'hôte
    const requestDrawPermission = useCallback((roomId: string) => {
        setHasPendingRequest(true);
        socketService.getSocket().emit('whiteboard:request-draw', { roomId });
    }, []);

    // Hôte autorise un participant
    const allowDraw = useCallback((targetSocketId: string) => {
        setPendingDrawRequest(null);
        socketService.getSocket().emit('whiteboard:allow-draw', { targetSocketId });
    }, []);

    // Hôte refuse un participant
    const denyDraw = useCallback((targetSocketId: string) => {
        setPendingDrawRequest(null);
        socketService.getSocket().emit('whiteboard:deny-draw', { targetSocketId });
    }, []);

    return {
        strokes,
        currentColor,
        currentWidth,
        isEraser,
        canDraw,
        hasPendingRequest,
        pendingDrawRequest,
        setCurrentColor,
        setCurrentWidth,
        setIsEraser,
        startStroke,
        addPoint,
        endStroke,
        clearBoard,
        requestDrawPermission,
        allowDraw,
        denyDraw,
    };
}
