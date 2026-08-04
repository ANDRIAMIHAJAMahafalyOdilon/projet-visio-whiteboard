import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';

type Role = 'host' | 'join';

function generateRoomId() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function LobbyScreen() {
    const navigation = useNavigation<any>();
    const [role, setRole] = useState<Role>('host');
    const [username, setUsername] = useState('');
    const [roomId, setRoomId] = useState(generateRoomId());

    const handleEnter = () => {
        if (!username.trim() || !roomId.trim()) return;
        navigation.navigate('MeetingRoom', {
            username: username.trim(),
            roomId: roomId.trim().toUpperCase(),
            isHost: role === 'host',
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
                <View style={styles.iconCircle}>
                    <Ionicons name="easel" size={36} color="#fff" />
                </View>
                <Text style={styles.title}>Visio + Tableau Blanc</Text>
                <Text style={styles.subtitle}>Choisis ton rôle pour commencer</Text>

                <View style={styles.roleRow}>
                    <TouchableOpacity
                        style={[styles.roleButton, role === 'host' && styles.roleButtonActive]}
                        onPress={() => { setRole('host'); setRoomId(generateRoomId()); }}
                    >
                        <Ionicons name="star" size={18} color={role === 'host' ? '#fff' : colors.textMuted} />
                        <Text style={[styles.roleText, role === 'host' && styles.roleTextActive]}>Héberger</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.roleButton, role === 'join' && styles.roleButtonActive]}
                        onPress={() => { setRole('join'); setRoomId(''); }}
                    >
                        <Ionicons name="enter" size={18} color={role === 'join' ? '#fff' : colors.textMuted} />
                        <Text style={[styles.roleText, role === 'join' && styles.roleTextActive]}>Rejoindre</Text>
                    </TouchableOpacity>
                </View>

                <TextInput
                    style={styles.input}
                    placeholder="Ton pseudo"
                    placeholderTextColor={colors.textMuted}
                    value={username}
                    onChangeText={setUsername}
                />

                {role === 'host' ? (
                    <View style={styles.hostIdBox}>
                        <Text style={styles.hostIdLabel}>ID de ta réunion (partage-le)</Text>
                        <View style={styles.hostIdRow}>
                            <Text style={styles.hostIdValue}>{roomId}</Text>
                            <TouchableOpacity onPress={() => setRoomId(generateRoomId())}>
                                <Ionicons name="refresh" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={styles.inputRow}>
                        <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            placeholder="ID de la réunion à rejoindre"
                            placeholderTextColor={colors.textMuted}
                            value={roomId}
                            onChangeText={(t) => setRoomId(t.toUpperCase())}
                            autoCapitalize="characters"
                        />
                        <TouchableOpacity
                            style={styles.pasteButton}
                            onPress={async () => {
                                const text = await Clipboard.getString();
                                if (text) setRoomId(text.trim().toUpperCase());
                            }}
                        >
                            <Ionicons name="clipboard-outline" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.joinButton, (!username || !roomId) && styles.joinButtonDisabled]}
                    onPress={handleEnter}
                    disabled={!username || !roomId}
                >
                    <Text style={styles.joinButtonText}>
                        {role === 'host' ? 'Démarrer la réunion' : 'Rejoindre la réunion'}
                    </Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
    iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
    title: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center' },
    subtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6, marginBottom: spacing.lg },
    roleRow: { flexDirection: 'row', marginBottom: spacing.lg, gap: spacing.sm },
    roleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    roleButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    roleText: { color: colors.textMuted, fontWeight: '600', marginLeft: 6 },
    roleTextActive: { color: '#fff' },
    input: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, color: colors.text, fontSize: 15, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
    hostIdBox: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
    hostIdLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
    hostIdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    hostIdValue: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: 2 },
    inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
    pasteButton: { backgroundColor: colors.primary, borderRadius: radius.md, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    joinButton: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.md, alignItems: 'center' },
    joinButtonDisabled: { opacity: 0.5 },
    joinButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});