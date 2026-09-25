// Adresse du serveur de signalement (Node.js + Socket.io).
// Surchargeable au build via EXPO_PUBLIC_SIGNALING_SERVER_URL (voir .env)
const buildEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
export const SIGNALING_SERVER_URL =
    buildEnv.EXPO_PUBLIC_SIGNALING_SERVER_URL?.replace(/\/$/, '') ||
    'https://serveur-signalement-visio.onrender.com';

// Serveurs STUN/TURN pour établir les connexions WebRTC à travers les NAT/pare-feu.
// - STUN  : aide à découvrir l'IP publique
// - TURN  : relaie le trafic quand P2P direct est impossible
// Open Relay (by Metered.ca) — gratuit, sans compte, 20 GB/mois
export const ICE_SERVERS: RTCIceServer[] = [
    // ── STUN ──────────────────────────────────────────────────────────────
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },

    // ── TURN (UDP 80) — passe la majorité des firewalls ───────────────────
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    // ── TURN (TCP 80) — fallback si UDP bloqué ────────────────────────────
    {
        urls: 'turn:openrelay.metered.ca:80?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    // ── TURNS (TLS 443) — passe les firewalls DPI (deep packet inspection) ─
    {
        urls: 'turns:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    // ── TURNS (TLS 443 TCP) — dernier recours, passe presque tout ─────────
    {
        urls: 'turns:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
];


export const DRAWING_COLORS = [
    '#000000',
    '#EF4444',
    '#3B82F6',
    '#22C55E',
    '#F59E0B',
    '#A855F7',
];

export const STROKE_WIDTHS = [2, 4, 6, 10];

/** Couleur utilisée par la gomme (identique au fond du canvas) */
export const ERASER_COLOR = '#FFFFFF';
