import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';

interface ControlBarProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isHandRaised: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleHand: () => void;
  onLeave: () => void;
}

export default function ControlBar({
  isMicOn, isCamOn, isHandRaised, onToggleMic, onToggleCam, onToggleHand, onLeave,
}: ControlBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <TouchableOpacity style={[styles.button, !isMicOn && styles.buttonOff]} onPress={onToggleMic}>
        <Ionicons name={isMicOn ? 'mic' : 'mic-off'} size={22} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, !isCamOn && styles.buttonOff]} onPress={onToggleCam}>
        <Ionicons name={isCamOn ? 'videocam' : 'videocam-off'} size={22} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, isHandRaised && styles.handActive]} onPress={onToggleHand}>
        <Ionicons name="hand-left" size={22} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.leaveButton]} onPress={onLeave}>
        <Ionicons name="call" size={22} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  button: { width: 52, height: 52, borderRadius: radius.full, backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  buttonOff: { backgroundColor: colors.danger },
  handActive: { backgroundColor: '#F59E0B' },
  leaveButton: { backgroundColor: colors.danger },
});