// Adresse du serveur de signalement (Node.js + Socket.io)
// TODO: remplace par l'IP/domaine de ton propre serveur
export const SIGNALING_SERVER_URL = 'https://serveur-signalement-visio.onrender.com';

// Serveurs STUN/TURN pour établir les connexions WebRTC à travers les NAT/pare-feu
export const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // TODO: ajoute un serveur TURN pour la prod (ex: via Twilio, Metered, ou coturn auto-hébergé)
    // { urls: 'turn:ton-serveur-turn.com:3478', username: 'user', credential: 'pass' },
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

export const MAX_PARTICIPANTS_GRID = 6;