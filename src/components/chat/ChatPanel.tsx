import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/theme';
import { ChatMessage } from '@/hooks/useChat';
import { formatTime } from '@/utils/formatters';

interface ChatPanelProps {
  messages: ChatMessage[];
  username: string;
  onSend: (text: string) => void;
}

export default function ChatPanel({ messages, username, onSend }: ChatPanelProps) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMine = item.sender === username;
          return (
            <View style={[styles.messageRow, isMine ? styles.rowRight : styles.rowLeft]}>
              <View style={[styles.bubble, isMine ? styles.myBubble : styles.otherBubble]}>
                {/* Pseudo au-dessus du message, masqué pour l'auteur lui-même */}
                {!isMine && (
                  <Text style={styles.senderName}>{item.sender}</Text>
                )}
                <Text style={[styles.messageText, isMine && styles.myMessageText]}>
                  {item.text}
                </Text>
                <Text style={[styles.timeText, isMine && styles.myTimeText]}>
                  {formatTime(new Date(item.timestamp))}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.inputBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.sm }]}>
        <TextInput
          style={styles.input}
          placeholder="Écris un message…"
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim()}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  messageRow: {
    marginBottom: spacing.sm,
    flexDirection: 'row',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  myBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: colors.surfaceLight,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 3,
  },
  messageText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  timeText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTimeText: {
    color: 'rgba(255,255,255,0.6)',
  },
  inputBar: {
    flexDirection: 'row',
    padding: spacing.sm,
    backgroundColor: colors.surface,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: spacing.sm,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
