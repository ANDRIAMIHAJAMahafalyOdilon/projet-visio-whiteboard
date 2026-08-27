# Frontend: Expo React Native App

See root `AGENTS.md` for full repo context.

## Quick reference

- **Expo SDK 57** (`expo@~57.0.14`). `package.json` is the source of truth for the SDK version.
- **Path alias**: `@/` → `./src/` — always use it for internal imports.
- **TypeScript strict**. No `node_modules` or `dist` in the repo.
- `react-native-webrtc` is excluded from Expo doctor checks.

## Commands

- `npm start` — Expo dev server
- `npm run android` — native Android build (requires `expo run:android`)
- `npm run web` — web build

## Structure

- Entry: `index.ts` → `App.tsx` → screens (`LobbyScreen` → `MeetingRoomScreen`)
- Services: `src/services/socketService.ts`, `src/services/webRTCService.ts`
- Hooks: `src/hooks/` (one per feature: `useChat`, `useDrawing`, `useWebRTC`, `useRaisedHand`)
- Components: `src/components/` (organized by feature: `chat/`, `video/`, `whiteboard/`)
- Theme: `src/theme/colors.ts` — dark theme, primary `#5865F2`
- Constants: `src/utils/constants.ts` — server URL, ICE servers, drawing config

## Gotchas

- EAS Build requires CLI ≥ 12. APK-only for internal distribution.
- No TURN server configured — only STUN. WebRTC will fail behind symmetric NAT.
