import type { AssistantTurn } from '@aurelia/shared';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ElderHeader, MIN_TOUCH, type Section } from '@/elder/ui';
import { friendlyError } from '@/lib/errors';
import { firstName } from '@/lib/format';
import { useAssistantMessage, useElderSelf } from '@/queries';
import { PatientColors, PatientTypography } from '@/theme';

const SECTION: Section = {
  main: PatientColors.aureliaMain,
  headerButton: PatientColors.aureliaHeaderButton,
  border: PatientColors.aureliaHeaderBorder,
  text: PatientColors.aureliaHeaderText,
};

interface Message {
  id: string;
  from: 'user' | 'aurelia';
  text: string;
  /** A bubble that explains a failure: shown, but never sent back as history. */
  failed?: boolean;
}

const HISTORY_LIMIT = 20;
const TURN_MAX_CHARS = 2000;
const LANGUAGE = 'pt-BR';

function historyOf(messages: Message[]): AssistantTurn[] {
  return messages
    .filter((m) => m.id !== 'welcome' && !m.failed)
    .map((m): AssistantTurn => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text.slice(0, TURN_MAX_CHARS) }))
    .slice(-HISTORY_LIMIT);
}

function speak(text: string) {
  Speech.stop();
  Speech.speak(text, { language: LANGUAGE, rate: 0.9 });
}

export default function ElderAssistantScreen() {
  const router = useRouter();
  const elder = useElderSelf();
  const ask = useAssistantMessage(elder.id);

  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 'welcome', from: 'aurelia', text: `Olá, ${firstName(elder.name)}! Eu sou a Aurélia. Como posso ajudar?` },
  ]);
  const [input, setInput] = useState('');
  const [readAloud, setReadAloud] = useState(true);
  const list = useRef<FlatList<Message>>(null);
  const nextId = useRef(0);

  // Quiet when leaving the screen.
  useEffect(() => () => void Speech.stop(), []);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || ask.isPending) return;
    const history = historyOf(messages);
    const mine: Message = { id: `u${nextId.current++}`, from: 'user', text };
    setMessages((prev) => [...prev, mine]);
    setInput('');
    ask.mutate(
      { message: text, history },
      {
        onSuccess: ({ reply }) => {
          setMessages((prev) => [...prev, { id: `a${nextId.current++}`, from: 'aurelia', text: reply }]);
          if (readAloud) speak(reply);
        },
        onError: (error) => {
          setMessages((prev) => [...prev, { id: `e${nextId.current++}`, from: 'aurelia', text: friendlyError(error), failed: true }]);
        },
      },
    );
  }, [input, ask, messages, readAloud]);

  function toggleReadAloud() {
    if (readAloud) Speech.stop();
    setReadAloud(!readAloud);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ElderHeader title="AURÉLIA" section={SECTION} onBack={() => router.back()} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={ask.isPending ? <Text style={styles.typing}>Aurélia está pensando…</Text> : null}
          renderItem={({ item }) => (
            <View style={[styles.row, item.from === 'user' ? styles.rowRight : styles.rowLeft]}>
              <View style={[styles.bubble, item.from === 'user' ? styles.userBubble : styles.aureliaBubble, item.failed && styles.failedBubble]}>
                <Text style={[styles.bubbleText, item.from === 'user' ? styles.userText : styles.aureliaText, item.failed && styles.failedText]}>
                  {item.text}
                </Text>
                {item.from === 'aurelia' && !item.failed ? (
                  <Pressable onPress={() => speak(item.text)} style={styles.listen} accessibilityRole="button" accessibilityLabel="Ouvir esta mensagem">
                    <Text style={styles.listenText}>🔊 OUVIR</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        />

        <View style={styles.composer}>
          <Pressable
            onPress={toggleReadAloud}
            style={[styles.soundToggle, !readAloud && styles.soundOff]}
            accessibilityRole="switch"
            accessibilityState={{ checked: readAloud }}
            accessibilityLabel="Ler as respostas em voz alta"
          >
            <Text style={styles.soundToggleText}>{readAloud ? '🔊 VOZ LIGADA' : '🔇 VOZ DESLIGADA'}</Text>
          </Pressable>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Escreva aqui"
              placeholderTextColor="#5F5E5A"
              maxLength={500}
              multiline
              accessibilityLabel="Mensagem para a Aurélia"
            />
            <Pressable
              onPress={send}
              disabled={!input.trim() || ask.isPending}
              style={[styles.sendButton, (!input.trim() || ask.isPending) && styles.sendDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Enviar mensagem"
            >
              <Text style={styles.sendText}>ENVIAR</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PatientColors.aureliaChatBg },
  flex: { flex: 1 },
  messages: { padding: 16, gap: 14 },
  row: { flexDirection: 'row' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '88%', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  aureliaBubble: { backgroundColor: PatientColors.aureliaBubbleAI, borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: PatientColors.aureliaBubbleUser, borderBottomRightRadius: 4 },
  failedBubble: { backgroundColor: PatientColors.sosBg, borderWidth: 1, borderColor: PatientColors.sosMain },
  bubbleText: { fontSize: PatientTypography.size.common, lineHeight: PatientTypography.size.common * PatientTypography.lineHeight.tight },
  aureliaText: { color: PatientColors.aureliaBubbleAIText },
  userText: { color: PatientColors.aureliaBubbleUserText },
  failedText: { color: PatientColors.sosText },
  listen: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  listenText: { fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold, color: PatientColors.aureliaMain },
  typing: { fontSize: PatientTypography.size.reduced, color: '#5F5E5A', paddingLeft: 8 },
  composer: { backgroundColor: '#FFFFFF', padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#D3D1C7' },
  soundToggle: { minHeight: MIN_TOUCH, borderRadius: 12, backgroundColor: PatientColors.aureliaMain, alignItems: 'center', justifyContent: 'center' },
  soundOff: { backgroundColor: '#5F5E5A' },
  soundToggleText: { fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold, color: '#FFFFFF' },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  input: {
    flex: 1,
    minHeight: 64,
    maxHeight: 140,
    borderWidth: 1.5,
    borderColor: PatientColors.aureliaMain,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: PatientTypography.size.common,
    color: PatientColors.aureliaBubbleAIText,
  },
  sendButton: { minHeight: 64, minWidth: 110, borderRadius: 12, backgroundColor: PatientColors.aureliaMain, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  sendDisabled: { opacity: 0.5 },
  sendText: { fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold, color: '#FFFFFF' },
});
