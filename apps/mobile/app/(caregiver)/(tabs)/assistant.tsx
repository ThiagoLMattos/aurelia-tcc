/**
 * Aurélia — Chat screen
 * The caregiver asks questions about the elder in natural language. Answers come from the API's
 * assistant (grounded in the elder's agenda and the last 7 days); the conversation lives in
 * component state only and is not stored.
 */

import type { AssistantTurn } from '@aurelia/shared';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { friendlyError } from '@/lib/errors';
import { firstName } from '@/lib/format';
import { useAssistantMessage, useCurrentElder } from '@/queries';
import { Colors, Radius, Spacing, Typography } from '@/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'aurelia' | 'user';

interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
  /** A bubble that explains a failure; it is shown but never sent back as conversation history. */
  failed?: boolean;
}

/** The API keeps at most this many earlier turns (and 2 000 characters each). */
const HISTORY_LIMIT = 20;
const TURN_MAX_CHARS = 2000;

const suggestionsFor = (name: string) => [
  'Como foi a semana?',
  'Medicações de hoje?',
  'Algum alerta importante?',
  `${name} tomou o remédio da manhã?`,
  'Qual a aderência esta semana?',
  `${name} saiu da zona segura?`,
  `O que ${name} perdeu hoje?`,
];

function historyOf(messages: Message[]): AssistantTurn[] {
  return messages
    .filter((m) => m.id !== 'welcome' && !m.failed)
    .map((m): AssistantTurn => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text.slice(0, TURN_MAX_CHARS) }))
    .slice(-HISTORY_LIMIT);
}

// ─── Message bubble ───────────────────────────────────────────────────────────
// showAvatar/showTime: only true on the last message of each consecutive-role group
// onSuggest: only passed to the welcome message (id === 'welcome') while conversation hasn't started

function MessageBubble({
  message,
  showAvatar,
  showTime,
  isFirst,
  suggestions,
  onSuggest,
}: {
  message: Message;
  showAvatar: boolean;
  showTime: boolean;
  isFirst: boolean;
  suggestions: string[];
  onSuggest?: (text: string) => void;
}) {
  const isAurelia = message.role === 'aurelia';
  return (
    <View style={[
      styles.bubbleRow,
      isAurelia ? styles.bubbleRowLeft : styles.bubbleRowRight,
      !isFirst && { marginTop: 2 },
    ]}>
      {/* Avatar placeholder keeps bubbles aligned even when avatar is hidden */}
      {isAurelia && (
        <View style={[styles.aureliaAvatar, !showAvatar && styles.aureliaAvatarHidden]}>
          {showAvatar && <Text style={styles.aureliaAvatarText}>A</Text>}
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isAurelia ? styles.aureliaBubble : styles.userBubble,
          message.failed && { borderColor: Colors.dangerBorder, borderWidth: 1, backgroundColor: Colors.dangerBg },
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isAurelia ? styles.aureliaBubbleText : styles.userBubbleText,
            message.failed && { color: Colors.dangerText },
          ]}
        >
          {message.text}
        </Text>
        {/* Quick-reply chips — only on welcome message while no user message yet */}
        {onSuggest && (
          <View style={styles.chipsWrap}>
            {suggestions.map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.chip}
                onPress={() => onSuggest(s)}
                activeOpacity={0.75}
              >
                <Text style={styles.chipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {showTime && (
          <Text style={[styles.bubbleTime, isAurelia ? styles.aureliaBubbleTime : styles.userBubbleTime]}>
            {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowLeft]}>
      <View style={styles.aureliaAvatar}>
        <Text style={styles.aureliaAvatarText}>A</Text>
      </View>
      <View style={[styles.bubble, styles.aureliaBubble, styles.typingBubble]}>
        <Text style={styles.typingDots}>• • •</Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AureliaScreen() {
  const elder = useCurrentElder();
  const name = firstName(elder.name);
  const ask = useAssistantMessage(elder.id);

  const welcome = useMemo<Message>(
    () => ({
      id: 'welcome',
      role: 'aurelia',
      text: `Olá! Sou a Aurélia, sua assistente de cuidados. Posso te ajudar a acompanhar as medicações, tarefas, localização e a aderência semanal de ${name}. O que você gostaria de saber?`,
      timestamp: new Date(),
    }),
    [name],
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<Message>>(null);
  const suggestions = useMemo(() => suggestionsFor(name), [name]);
  const isTyping = ask.isPending;

  const all = useMemo(() => [welcome, ...messages], [welcome, messages]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || ask.isPending) return;

      const history = historyOf(all);
      const userMsg: Message = { id: `msg-${Date.now()}`, role: 'user', text: trimmed, timestamp: new Date() };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');

      ask.mutate(
        { message: trimmed, history },
        {
          onSuccess: ({ reply }) =>
            setMessages((prev) => [...prev, { id: `msg-${Date.now()}-a`, role: 'aurelia', text: reply, timestamp: new Date() }]),
          onError: (error) =>
            setMessages((prev) => [
              ...prev,
              { id: `msg-${Date.now()}-e`, role: 'aurelia', text: friendlyError(error), timestamp: new Date(), failed: true },
            ]),
        },
      );
    },
    [all, ask],
  );

  // Scroll to bottom when new message arrives
  useEffect(() => {
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  // Conversation has started when there's at least one user message
  const hasUserMessage = messages.some((m) => m.role === 'user');

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const prev = index > 0 ? all[index - 1] : null;
      const next = all[index + 1];
      const isFirst = !prev || prev.role !== item.role;
      const isLastInGroup = !next || next.role !== item.role;
      // Pass onSuggest only to the welcome message before the user has typed anything
      const showChips = item.id === 'welcome' && !hasUserMessage && !isTyping;
      return (
        <MessageBubble
          message={item}
          showAvatar={isLastInGroup}
          showTime={isLastInGroup}
          isFirst={isFirst}
          suggestions={suggestions}
          onSuggest={showChips ? sendMessage : undefined}
        />
      );
    },
    [all, hasUserMessage, isTyping, sendMessage, suggestions],
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.aureliaText} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>A</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Aurélia</Text>
          <Text style={styles.headerSub}>Assistente de cuidados · {name}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={listRef}
          data={all}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={`Pergunte sobre ${name}...`}
            placeholderTextColor={Colors.textSecondary}
            multiline
            maxLength={300}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(input)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            activeOpacity={0.85}
          >
            <IconSymbol name="paperplane.fill" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.aureliaText,
  },
  flex: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.aureliaText,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.white,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.white,
  },
  headerSub: {
    fontSize: Typography.size.sm,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },

  // Messages
  messageList: {
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },

  // Bubbles
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 4,
  },
  bubbleRowLeft: {
    justifyContent: 'flex-start',
  },
  bubbleRowRight: {
    justifyContent: 'flex-end',
  },
  aureliaAvatar: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.aureliaText,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  aureliaAvatarHidden: {
    backgroundColor: 'transparent',
  },
  aureliaAvatarText: {
    fontSize: 12,
    fontWeight: Typography.weight.bold,
    color: Colors.white,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  aureliaBubble: {
    backgroundColor: Colors.white,
    borderWidth: 0.5,
    borderColor: Colors.aureliaBorder,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: Colors.aureliaText,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },
  aureliaBubbleText: {
    color: Colors.textPrimary,
  },
  userBubbleText: {
    color: Colors.white,
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 4,
  },
  aureliaBubbleTime: {
    color: Colors.textSecondary,
    textAlign: 'left',
  },
  userBubbleTime: {
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'right',
  },

  // Typing indicator
  typingBubble: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
  },
  typingDots: {
    fontSize: Typography.size.md,
    color: Colors.aureliaText,
    letterSpacing: 2,
  },

  // Quick-reply chips inside the welcome bubble
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
  },
  chip: {
    backgroundColor: Colors.aureliaBg,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.aureliaBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: Typography.size.sm,
    color: Colors.aureliaText,
    fontWeight: Typography.weight.medium,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderTopWidth: 0.5,
    borderTopColor: Colors.borderLight,
    padding: Spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Typography.size.sm,
    color: Colors.textPrimary,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.aureliaText,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.tabInactive,
  },
});
