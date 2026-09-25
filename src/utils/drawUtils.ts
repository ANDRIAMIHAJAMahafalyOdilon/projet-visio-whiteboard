export interface Point {
    x: number;
    y: number;
}

export interface Stroke {
    id: string;
    points: Point[];
    color: string;
    width: number;
    authorId: string;
}

/**
 * Convertit une liste de points en chaîne "path" SVG lissée
 * via des courbes quadratiques passant par les points milieux.
 */
export function pointsToSvgPath(points: Point[]): string {
    if (points.length === 0) return '';
    if (points.length === 1) {
        const p = points[0];
        return `M ${p.x} ${p.y} L ${p.x} ${p.y}`;
    }

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        path += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
    }

    const last = points[points.length - 1];
    path += ` L ${last.x} ${last.y}`;

    return path;
}

/**
 * Réduit le nombre de points en ne gardant que ceux distants
 * d'au moins `minDistance` pixels, pour limiter le volume de données
 * envoyées sur le WebSocket.
 */
export function simplifyPoints(points: Point[], minDistance: number = 3): Point[] {
    if (points.length < 3) return points;
    const result: Point[] = [points[0]];

    for (let i = 1; i < points.length; i++) {
        const last = result[result.length - 1];
        const dx = points[i].x - last.x;
        const dy = points[i].y - last.y;
        if (Math.sqrt(dx * dx + dy * dy) >= minDistance) {
            result.push(points[i]);
        }
    }

    return result;
}

function randomHex(length: number): string {
    const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
    if (cryptoObj?.getRandomValues) {
        const bytes = new Uint8Array(Math.ceil(length / 2));
        cryptoObj.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
    }
    let out = '';
    for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 16).toString(16);
    return out;
}

export function generateId(): string {
    const rand = randomHex(12);
    return Date.now().toString(36) + rand;
}