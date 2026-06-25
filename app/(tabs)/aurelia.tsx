/**
 * Aurélia — Chat screen
 * The caregiver can ask questions about Maria in natural language.
 * Responses are generated from real app state (tasks, history, geo-fence, elder profile).
 * Mock-first: no LLM backend yet — keyword-matching against context data.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

import { useApp } from '@/context/AppContext';
import { DayHistory, Task } from '@/data/mock';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'aurelia' | 'user';

interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
}

// ─── Suggested questions ──────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Como foi a semana?',
  'Medicações de hoje?',
  'Algum alerta importante?',
  'Maria tomou o remédio da manhã?',
  'Qual a aderência esta semana?',
  'Maria saiu da zona segura?',
  'O que Maria perdeu hoje?',
];

// ─── Mock response engine ─────────────────────────────────────────────────────

function isMed(t: Task) {
  const n = t.name.toLowerCase();
  return n.includes('medicaç') || n.includes('remédio') || n.includes('comprimido') || n.includes('mg');
}

function computeWeekAdherence(week: DayHistory[]): { med: number; task: number } {
  let medDone = 0; let medTotal = 0;
  let taskDone = 0; let taskTotal = 0;
  week.forEach((day) => {
    day.events.forEach((e) => {
      const isM = isMedTitle(e.title);
      if (isM) {
        medTotal++;
        if (e.type === 'done') medDone++;
      } else {
        taskTotal++;
        if (e.type === 'done') taskDone++;
      }
    });
  });
  return {
    med: medTotal > 0 ? medDone / medTotal : 1,
    task: taskTotal > 0 ? taskDone / taskTotal : 1,
  };
}

function isMedTitle(title: string) {
  const t = title.toLowerCase();
  return t.includes('medicaç') || t.includes('remédio') || t.includes('mg') || t.includes('comprimido') || t.includes('donepezil') || t.includes('memantina') || t.includes('omeprazol');
}

function pct(v: number) { return Math.round(v * 100); }

function generateResponse(
  raw: string,
  tasks: Task[],
  weekHistory: DayHistory[],
  geoFenceStatus: string,
  elderName: string,
): string {
  const msg = raw.toLowerCase();
  const firstName = elderName.split(' ')[0];

  // ── Geo-fence / safety ──────────────────────────────────────────────────
  if (msg.includes('zona') || msg.includes('saiu') || msg.includes('localização') || msg.includes('fora')) {
    if (geoFenceStatus === 'outside') {
      return `⚠️ Atenção: ${firstName} está fora da zona segura agora mesmo. Você deve verificar a localização dela imediatamente e, se necessário, acionar o protocolo de emergência.`;
    }
    const breachDays = weekHistory.filter((d) =>
      d.events.some((e) => e.title.toLowerCase().includes('saiu') || e.title.toLowerCase().includes('zona')),
    );
    if (breachDays.length > 0) {
      return `${firstName} está dentro da zona segura agora. Esta semana, houve ${breachDays.length} ${breachDays.length === 1 ? 'ocorrência' : 'ocorrências'} de saída da área — no${breachDays.length === 1 ? '' : 's'} dia${breachDays.length === 1 ? '' : 's'} ${breachDays.map((d) => d.date).join(', ')}. Sem outros alertas de localização.`;
    }
    return `${firstName} está dentro da zona segura e não houve nenhuma saída registrada esta semana. Tudo tranquilo nesse sentido.`;
  }

  // ── Medication status today ─────────────────────────────────────────────
  if (
    msg.includes('remédio') || msg.includes('medicaç') || msg.includes('tomou') ||
    msg.includes('comprimido') || msg.includes('donepezil') || msg.includes('dose')
  ) {
    const meds = tasks.filter(isMed);
    if (meds.length === 0) {
      return `Não há medicações registradas para hoje. Se isso parecer errado, verifique as rotinas configuradas.`;
    }
    const done = meds.filter((t) => t.status === 'done');
    const missed = meds.filter((t) => t.status === 'missed');
    const pending = meds.filter((t) => t.status === 'pending' || t.status === 'now');

    const lines: string[] = [];
    if (done.length > 0) lines.push(`✅ Tomadas: ${done.map((t) => t.name).join(', ')}`);
    if (missed.length > 0) lines.push(`❌ Perdidas: ${missed.map((t) => t.name).join(', ')}`);
    if (pending.length > 0) lines.push(`⏳ Pendentes: ${pending.map((t) => t.name).join(', ')}`);

    const intro =
      missed.length === 0 && pending.length === 0
        ? `Ótimas notícias! ${firstName} tomou todas as medicações de hoje. `
        : missed.length > 0
        ? `Atenção: ${firstName} perdeu ${missed.length} ${missed.length === 1 ? 'medicação' : 'medicações'} hoje. `
        : `${firstName} ainda tem ${pending.length} ${pending.length === 1 ? 'medicação pendente' : 'medicações pendentes'} hoje. `;

    return intro + '\n\n' + lines.join('\n');
  }

  // ── Missed tasks today ──────────────────────────────────────────────────
  if (msg.includes('perdeu') || msg.includes('perdidas') || msg.includes('faltou') || msg.includes('faltaram')) {
    const missed = tasks.filter((t) => t.status === 'missed');
    if (missed.length === 0) {
      return `${firstName} não perdeu nenhuma tarefa hoje até agora. Continue assim! 🌟`;
    }
    return `Hoje ${firstName} perdeu ${missed.length} ${missed.length === 1 ? 'tarefa' : 'tarefas'}:\n\n${missed.map((t) => `• ${t.name} (${t.time})`).join('\n')}\n\nSe necessário, você pode registrar manualmente ou entrar em contato com ${firstName}.`;
  }

  // ── Week overview ───────────────────────────────────────────────────────
  if (
    msg.includes('semana') || msg.includes('aderência') || msg.includes('como foi') ||
    msg.includes('resumo') || msg.includes('relatório') || msg.includes('desempenho')
  ) {
    const { med, task } = computeWeekAdherence(weekHistory);
    const medPct = pct(med);
    const taskPct = pct(task);

    const medStatus =
      medPct >= 90 ? 'excelente 🟢' : medPct >= 75 ? 'boa, mas com algumas falhas 🟡' : 'abaixo do ideal, requer atenção 🔴';
    const taskStatus =
      taskPct >= 90 ? 'excelente 🟢' : taskPct >= 75 ? 'boa 🟡' : 'baixa 🔴';

    return `Aqui está o resumo desta semana para ${firstName}:\n\n💊 Aderência às medicações: ${medPct}% — ${medStatus}\n✅ Aderência geral às tarefas: ${taskPct}% — ${taskStatus}\n\n${medPct >= 85 && taskPct >= 85 ? `${firstName} está tendo uma semana muito positiva. Continue com o acompanhamento regular.` : `Recomendo verificar quais medicações estão sendo perdidas e, se necessário, revisar os horários com o médico responsável.`}`;
  }

  // ── Today overview ──────────────────────────────────────────────────────
  if (msg.includes('hoje') || msg.includes('dia') || msg.includes('agora')) {
    const done = tasks.filter((t) => t.status === 'done').length;
    const missed = tasks.filter((t) => t.status === 'missed').length;
    const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'now').length;

    return `Hoje ${firstName} tem ${tasks.length} ${tasks.length === 1 ? 'tarefa' : 'tarefas'} programadas:\n\n✅ Concluídas: ${done}\n⏳ Pendentes: ${pending}\n❌ Perdidas: ${missed}\n\n${missed > 0 ? `Há ${missed} ${missed === 1 ? 'tarefa perdida' : 'tarefas perdidas'} que precisam de atenção.` : pending > 0 ? 'O dia segue bem, ainda há tarefas pela frente.' : 'Parabéns, todas as tarefas do dia foram concluídas! 🎉'}`;
  }

  // ── Alerts ──────────────────────────────────────────────────────────────
  if (msg.includes('alerta') || msg.includes('urgente') || msg.includes('preocupaç') || msg.includes('problema')) {
    const alerts: string[] = [];
    if (geoFenceStatus === 'outside') alerts.push(`⚠️ ${firstName} está fora da zona segura agora`);
    const missedMeds = tasks.filter((t) => isMed(t) && t.status === 'missed');
    if (missedMeds.length > 0) alerts.push(`💊 ${missedMeds.length} ${missedMeds.length === 1 ? 'medicação perdida' : 'medicações perdidas'} hoje`);
    const { med } = computeWeekAdherence(weekHistory);
    if (pct(med) < 75) alerts.push(`📉 Aderência às medicações abaixo de 75% esta semana`);

    if (alerts.length === 0) {
      return `Nenhum alerta ativo no momento. ${firstName} está dentro da zona segura e a aderência às medicações está em dia. Tudo tranquilo. ✅`;
    }
    return `Há ${alerts.length} ${alerts.length === 1 ? 'alerta' : 'alertas'} para você:\n\n${alerts.join('\n')}\n\nRecomendo verificar cada ponto com atenção.`;
  }

  // ── Greeting / who are you ──────────────────────────────────────────────
  if (
    msg.includes('quem é') || msg.includes('o que você') || msg.includes('o que tu') ||
    msg.includes('olá') || msg.includes('oi') || msg.includes('bom dia') || msg.includes('boa tarde') || msg.includes('boa noite')
  ) {
    return `Olá! Sou a Aurélia, a assistente de cuidados de ${firstName}. Posso te ajudar a acompanhar as medicações, tarefas, localização e aderência semanal de ${firstName}. É só perguntar! 💜`;
  }

  // ── Thank you ──────────────────────────────────────────────
  if (
    msg.includes('obrigad') || msg.includes('valeu') || msg.includes('agradeç') ||
    msg.includes('bom trabalho') || msg.includes('ótimo') || msg.includes('excelente')
  ) {
    return `Fico feliz em ajudar! 😊 Se tiver mais alguma dúvida ou quiser saber sobre as medicações, tarefas, localização ou aderência semanal de ${firstName}, é só perguntar. Estou aqui para facilitar o acompanhamento dos cuidados! 💜`;
  }

  // ── Default ─────────────────────────────────────────────────────────────
  return `Entendi sua pergunta, mas ainda estou aprendendo a responder sobre esse assunto. Posso te ajudar com medicações, tarefas do dia, aderência semanal, alertas de localização e o resumo da semana de ${firstName}. Tente perguntar sobre um desses temas!`;
}

// ─── Message bubble ───────────────────────────────────────────────────────────
// showAvatar/showTime: only true on the last message of each consecutive-role group
// onSuggest: only passed to the welcome message (id === 'welcome') while conversation hasn't started

function MessageBubble({
  message,
  showAvatar,
  showTime,
  isFirst,
  onSuggest,
}: {
  message: Message;
  showAvatar: boolean;
  showTime: boolean;
  isFirst: boolean;
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
      <View style={[styles.bubble, isAurelia ? styles.aureliaBubble : styles.userBubble]}>
        <Text style={[styles.bubbleText, isAurelia ? styles.aureliaBubbleText : styles.userBubbleText]}>
          {message.text}
        </Text>
        {/* Quick-reply chips — only on welcome message while no user message yet */}
        {onSuggest && (
          <View style={styles.chipsWrap}>
            {SUGGESTIONS.map((s) => (
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

const WELCOME: Message = {
  id: 'welcome',
  role: 'aurelia',
  text: 'Olá! Sou a Aurélia, sua assistente de cuidados. Posso te ajudar a acompanhar as medicações, tarefas, localização e a aderência semanal de Maria. O que você gostaria de saber?',
  timestamp: new Date(),
};

export default function AureliaScreen() {
  const { tasks, weekHistory, geoFenceStatus, elder } = useApp();

  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      const userMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        text: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsTyping(true);

      // Simulate Aurélia "thinking" for 900ms
      setTimeout(() => {
        const responseText = generateResponse(text, tasks, weekHistory, geoFenceStatus, elder.name);
        const aureliaMsg: Message = {
          id: `msg-${Date.now()}-a`,
          role: 'aurelia',
          text: responseText,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aureliaMsg]);
        setIsTyping(false);
      }, 900);
    },
    [tasks, weekHistory, geoFenceStatus, elder.name],
  );

  // Scroll to bottom when new message arrives
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isTyping]);

  // Conversation has started when there's at least one user message
  const hasUserMessage = useMemo(() => messages.some((m) => m.role === 'user'), [messages]);

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const prev = index > 0 ? messages[index - 1] : null;
      const next = messages[index + 1];
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
          onSuggest={showChips ? sendMessage : undefined}
        />
      );
    },
    [messages, hasUserMessage, isTyping, sendMessage],
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
          <Text style={styles.headerSub}>Assistente de cuidados · {elder.name.split(' ')[0]}</Text>
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
          data={messages}
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
            placeholder="Pergunte sobre Maria..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            maxLength={300}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(input)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
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
