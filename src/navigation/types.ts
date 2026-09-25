export type RootStackParamList = {
    Lobby: undefined;
    MeetingRoom: { roomId: string; username: string; isHost: boolean };
};