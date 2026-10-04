/**
 * Aurélia — Home screen (Início)
 * Primary daily-use screen for the caregiver.
 * Answers "está tudo bem agora?" in under 3 seconds.
 *
 * Three states driven entirely by AppContext:
 *   1. Normal       — tudo certo, geo-fence OK
 *   2. Alerta       — tarefa perdida (amber)
 *   3. Saída zona   — geo-fence breach (red)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useRouter } from 'expo-router';

import { countTasksByStatus, getCurrentTask, useApp } from '@/context/AppContext';
import { DayHistory, Task } from '@/data/mock';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScreenState = 'normal' | 'missed' | 'breach';
type ActiveTab = 'hoje' | 'relatorios';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns minutes until a 'HH:MM' time string from now. Negative = overdue. */
function minutesUntil(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

function formatCountdown(minutes: number): string {
  if (minutes > 0) return `Em ${minutes} min`;
  if (minutes === 0) return 'Agora';
  return `${Math.abs(minutes)} min atrás`;
}

function taskTypeIcon(type: Task['type']): 'pills.fill' | 'fork.knife' | 'figure.walk' | 'star.fill' {
  switch (type) {
    case 'medication': return 'pills.fill';
    case 'meal': return 'fork.knife';
    case 'activity': return 'figure.walk';
    default: return 'star.fill';
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Header bar (teal)
function HeaderBar({
  elderName,
  screenState,
  missedCount,
}: {
  elderName: string;
  screenState: ScreenState;
  missedCount: number;
}) {
  const badgeStyle =
    screenState === 'breach'
      ? styles.badgeDanger
      : screenState === 'missed'
      ? styles.badgeAlert
      : styles.badgeOk;

  const badgeText =
    screenState === 'breach'
      ? 'Saída detectada'
      : screenState === 'missed'
      ? `${missedCount} perdida${missedCount > 1 ? 's' : ''}`
      : 'Tudo certo';

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerName}>{elderName}</Text>
        <Text style={styles.headerSub}>Gerenciado por você</Text>
      </View>
      <View style={[styles.badge, badgeStyle]}>
        <Text
          style={[
            styles.badgeText,
            screenState === 'breach'
              ? styles.badgeTextDanger
              : screenState === 'missed'
              ? styles.badgeTextAlert
              : styles.badgeTextOk,
          ]}
        >
          {badgeText}
        </Text>
      </View>
    </View>
  );
}

// Tab pills (Hoje / Relatórios) — Histórico removed, dedicated tab exists in bottom bar
function TabPills({
  active,
  onChange,
}: {
  active: ActiveTab;
  onChange: (t: ActiveTab) => void;
}) {
  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'hoje',      label: 'Hoje' },
    { key: 'relatorios', label: 'Relatórios' },
  ];

  return (
    <View style={styles.tabPillsRow}>
      {tabs.map((t) => (
        <TouchableOpacity
          key={t.key}
          onPress={() => onChange(t.key)}
          style={[styles.tabPill, active === t.key && styles.tabPillActive]}
        >
          <Text style={[styles.tabPillText, active === t.key && styles.tabPillTextActive]}>
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Alert banner (conditional — amber or red)
function AlertBanner({
  screenState,
  missedTaskName,
  missedTaskTime,
  onBreachPress,
}: {
  screenState: ScreenState;
  missedTaskName?: string;
  missedTaskTime?: string;
  onBreachPress: () => void;
}) {
  if (screenState === 'normal') return null;

  if (screenState === 'missed') {
    return (
      <View style={styles.alertBannerAmber}>
        <View style={styles.alertBannerRow}>
          <IconSymbol name="exclamationmark.triangle.fill" size={14} color={Colors.warningText} />
          <Text style={styles.alertBannerText}>
            <Text style={styles.alertBannerBold}>Perdida: {missedTaskTime}</Text>
            {' — '}{missedTaskName} não confirmada.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={onBreachPress} activeOpacity={0.85}>
      <View style={styles.alertBannerRed}>
        <View style={styles.alertBannerRow}>
          <IconSymbol name="location.slash.fill" size={14} color={Colors.dangerText} />
          <Text style={styles.alertBannerText}>
            <Text style={styles.alertBannerBold}>Maria saiu da zona segura.</Text>
            {' '}Toque para ver detalhes.
          </Text>
          <IconSymbol name="chevron.right" size={14} color={Colors.dangerText} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// "Agora" card
function RightNowCard({
  task,
  screenState,
  counts,
  onMarkDone,
  onBreachPress,
}: {
  task: Task | null;
  screenState: ScreenState;
  counts: ReturnType<typeof countTasksByStatus>;
  onMarkDone: (id: string) => void;
  onBreachPress: () => void;
}) {
  const [countdown, setCountdown] = useState(task ? minutesUntil(task.time) : 0);

  useEffect(() => {
    if (!task || screenState === 'breach') return;
    const timer = setInterval(() => {
      setCountdown(minutesUntil(task.time));
    }, 30000); // refresh every 30s
    setCountdown(minutesUntil(task.time));
    return () => clearInterval(timer);
  }, [task, screenState]);

  const progress = counts.total > 0 ? counts.done / counts.total : 0;

  // Breach state — repurpose card to show breach info
  if (screenState === 'breach') {
    return (
      <View style={[styles.card, styles.cardBreach]}>
        <View style={styles.taskCardHeader}>
          <Text style={[styles.taskTitle, { color: Colors.dangerText }]}>
            Saída da zona segura
          </Text>
          <View style={styles.chipDanger}>
            <Text style={styles.chipDangerText}>Ativa agora</Text>
          </View>
        </View>
        <Text style={styles.taskDesc}>
          Última localização: ~80m fora do raio seguro.
        </Text>
        <TouchableOpacity onPress={onBreachPress} style={styles.btnBreachDetail}>
          <IconSymbol name="map.fill" size={14} color={Colors.white} />
          <Text style={styles.btnBreachDetailText}>Ver alerta completo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No pending task
  if (!task) {
    return (
      <View style={styles.card}>
        <Text style={styles.taskTitle}>Todas as tarefas concluídas</Text>
        <Text style={styles.taskDesc}>Ótimo dia para Maria!</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
          <Text style={styles.progressLabel}>{counts.done} de {counts.total} feitas</Text>
        </View>
      </View>
    );
  }

  const countdownLabel = formatCountdown(countdown);
  const chipStyle = countdown < 0 ? styles.chipOverdue : styles.chipPending;
  const chipTextStyle = countdown < 0 ? styles.chipOverdueText : styles.chipPendingText;

  return (
    <View style={styles.card}>
      <View style={styles.taskCardHeader}>
        <View style={styles.taskTitleRow}>
          <IconSymbol name={taskTypeIcon(task.type)} size={14} color={Colors.primary} />
          <Text style={styles.taskTitle}>{task.name}</Text>
        </View>
        <View style={[styles.chip, chipStyle]}>
          <Text style={[styles.chipText, chipTextStyle]}>{countdownLabel}</Text>
        </View>
      </View>

      <Text style={styles.taskDesc}>{task.description}</Text>

      <View style={styles.progressRow}>
        <View style={styles.progressBg}>
          <Animated.View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{counts.done} de {counts.total} feitas</Text>
      </View>

      <View style={styles.geoRow}>
        <Text style={styles.geoLabel}>Localização</Text>
        <View style={styles.chipGeoOk}>
          <IconSymbol name="location.fill" size={10} color={Colors.successText} />
          <Text style={styles.chipGeoOkText}>Dentro da zona segura</Text>
        </View>
      </View>

      {task.status !== 'done' && (
        <TouchableOpacity
          style={styles.btnMarkDone}
          onPress={() => onMarkDone(task.id)}
          activeOpacity={0.8}
        >
          <IconSymbol name="checkmark" size={14} color={Colors.white} />
          <Text style={styles.btnMarkDoneText}>Confirmar manualmente</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Timeline scroll — simple display, no interactive undo here
function TimelineScroll({ tasks }: { tasks: Task[] }) {
  const dotConfig: Record<Task['status'], { bg: string; color: string; icon: string }> = {
    done:    { bg: Colors.successBg,  color: Colors.successText,   icon: '✓' },
    pending: { bg: Colors.progressBg, color: Colors.textSecondary, icon: '–' },
    missed:  { bg: Colors.warningBg,  color: Colors.warningText,   icon: '✕' },
    now:     { bg: Colors.primary,    color: Colors.primaryLight,   icon: '●' },
  };

  return (
    <View>
      <Text style={styles.sectionLabel}>Linha do tempo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.timelineRow}>
          {tasks.map((task) => {
            const cfg = dotConfig[task.status];
            return (
              <View key={task.id} style={styles.timelineItem}>
                <Text style={styles.tlTime}>{task.time}</Text>
                <View style={[styles.tlDot, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.tlDotText, { color: cfg.color }]}>{cfg.icon}</Text>
                </View>
                <Text style={styles.tlLabel} numberOfLines={2}>{task.name.split(' ').slice(0, 2).join(' ')}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// Aurélia insight card — tappable, navigates to Aurélia chat tab
function AureliaCard({ screenState, missedCount }: { screenState: ScreenState; missedCount: number }) {
  const router = useRouter();
  const insightText =
    screenState === 'breach'
      ? 'Maria saiu da zona segura. Estou tentando alertá-la pelo dispositivo. Recomendo ligar agora.'
      : screenState === 'missed'
      ? missedCount > 1
        ? `A medicação das 14h não foi confirmada. É a ${missedCount}ª vez esta semana — vale verificar.`
        : 'A medicação das 14h não foi confirmada. Pode ter sido esquecida. Tudo mais está dentro do esperado.'
      : 'Tudo tranquilo hoje. Maria confirmou as tarefas da manhã dentro do horário. Boa tarde!';

  const flagText =
    screenState === 'breach'
      ? 'Ação urgente necessária'
      : screenState === 'missed' && missedCount > 1
      ? `${missedCount}ª ocorrência esta semana`
      : null;

  return (
    <TouchableOpacity
      style={styles.aureliaCard}
      onPress={() => router.push('/(tabs)/aurelia')}
      activeOpacity={0.85}
    >
      <View style={styles.aureliaAvatar}>
        <Text style={styles.aureliaAvatarText}>A</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.aureliaName}>Aurélia</Text>
        <Text style={styles.aureliaInsight}>{insightText}</Text>
        {flagText && (
          <View
            style={[
              styles.aureliaFlag,
              screenState === 'breach' && styles.aureliaFlagDanger,
            ]}
          >
            <Text
              style={[
                styles.aureliaFlagText,
                screenState === 'breach' && styles.aureliaFlagTextDanger,
              ]}
            >
              {flagText}
            </Text>
          </View>
        )}
      </View>
      <IconSymbol name="chevron.right" size={16} color={Colors.aureliaText} style={{ opacity: 0.5 }} />
    </TouchableOpacity>
  );
}

// ─── Relatórios view ─────────────────────────────────────────────────────────

/** Infer task type from event title (avoids adding taskType to every HistoryEvent). */
function isMedicationEvent(title: string): boolean {
  return title.toLowerCase().includes('medicação') || title.toLowerCase().includes('remédio');
}

/** Human-readable week range: "17–23 jun" */
function weekLabel(week: DayHistory[] | undefined): string {
  if (!week || !week.length) return '';
  const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const last = new Date(week[week.length - 1].date);
  return `${week[0].dayNum}–${week[week.length - 1].dayNum} ${MONTHS[last.getMonth()]}`;
}

type WeekMetrics = {
  medAdherence: number;   // 0–1
  taskAdherence: number;  // 0–1 (all non-med, non-breach tasks)
  breachCount: number;
  medDone: number;
  medTotal: number;
  taskDone: number;
  taskTotal: number;
  medByName: Record<string, { done: number; total: number }>;
};

const EMPTY_METRICS: WeekMetrics = {
  medAdherence: 1, taskAdherence: 1, breachCount: 0,
  medDone: 0, medTotal: 0, taskDone: 0, taskTotal: 0, medByName: {},
};

function computeMetrics(week: DayHistory[] | undefined): WeekMetrics {
  if (!week || week.length === 0) return EMPTY_METRICS;
  const allEvents = week.flatMap((d) => d.events);
  const nonBreachEvents = allEvents.filter((e) => e.type !== 'breach');
  const medEvents    = nonBreachEvents.filter((e) => isMedicationEvent(e.title));
  const nonMedEvents = nonBreachEvents.filter((e) => !isMedicationEvent(e.title));

  const medDone  = medEvents.filter((e) => e.type === 'done').length;
  const taskDone = nonMedEvents.filter((e) => e.type === 'done').length;

  const medByName: Record<string, { done: number; total: number }> = {};
  for (const e of medEvents) {
    if (!medByName[e.title]) medByName[e.title] = { done: 0, total: 0 };
    medByName[e.title].total++;
    if (e.type === 'done') medByName[e.title].done++;
  }

  return {
    medAdherence:  medEvents.length  > 0 ? medDone  / medEvents.length  : 1,
    taskAdherence: nonMedEvents.length > 0 ? taskDone / nonMedEvents.length : 1,
    breachCount:   allEvents.filter((e) => e.type === 'breach').length,
    medDone, medTotal: medEvents.length,
    taskDone, taskTotal: nonMedEvents.length,
    medByName,
  };
}

function generateInsight(cur: WeekMetrics, prev?: WeekMetrics): string {
  const medPct  = Math.round(cur.medAdherence * 100);
  const delta   = prev != null ? medPct - Math.round(prev.medAdherence * 100) : null;

  // Opening sentence
  let text = medPct >= 90
    ? `Boa semana para a medicação — ${medPct}% de aderência`
    : medPct >= 75
    ? `Semana razoável — ${medPct}% de aderência a medicamentos`
    : `Semana preocupante — apenas ${medPct}% de aderência a medicamentos`;

  if (delta !== null && delta !== 0) {
    text += delta > 0
      ? `, melhora de ${delta} p.p. em relação à semana anterior`
      : `, queda de ${Math.abs(delta)} p.p. em relação à semana anterior`;
  }
  text += '.';

  // Highlight weakest medication
  const worst = Object.entries(cur.medByName)
    .map(([name, { done, total }]) => ({ name, pct: total > 0 ? done / total : 1 }))
    .sort((a, b) => a.pct - b.pct)[0];
  if (worst && worst.pct < 1) {
    const worstPct = Math.round(worst.pct * 100);
    text += ` O ponto mais fraco foi "${worst.name}" (${worstPct}%) — vale confirmar o horário com Maria.`;
  }

  if (cur.breachCount > 0) {
    text += ` Houve ${cur.breachCount} evento${cur.breachCount > 1 ? 's' : ''} de saída da zona segura.`;
  }

  return text;
}

/** Delta badge: +10 pp ↑ in green / −5 pp ↓ in red / – when no prev data */
function DeltaBadge({ current, previous }: { current: number; previous?: number }) {
  if (previous == null) return null;
  const diff = Math.round((current - previous) * 100);
  if (diff === 0) return <Text style={styles.rDeltaFlat}>= estável</Text>;
  const up = diff > 0;
  return (
    <Text style={[styles.rDelta, up ? styles.rDeltaUp : styles.rDeltaDown]}>
      {up ? '▲' : '▼'} {up ? '+' : ''}{diff} p.p.
    </Text>
  );
}

function RelatoriosView({ weeks }: { weeks: DayHistory[][] }) {
  const safeIdx  = Math.max(0, weeks.length - 1);
  const [weekIdx, setWeekIdx] = useState(safeIdx);
  const curWeek  = weeks[weekIdx] ?? [];
  const prevWeek = weekIdx > 0 ? weeks[weekIdx - 1] : undefined;

  const cur  = useMemo(() => computeMetrics(curWeek),  [curWeek]);
  const prev = useMemo(() => prevWeek ? computeMetrics(prevWeek) : undefined, [prevWeek]);

  const insight = useMemo(() => generateInsight(cur, prev), [cur, prev]);

  const handleExport = useCallback(async () => {
    const label = weekLabel(curWeek);
    const medPct  = Math.round(cur.medAdherence * 100);
    const taskPct = Math.round(cur.taskAdherence * 100);
    const msg =
      `Relatório Aurélia — ${label}\n` +
      `Aderência a medicamentos: ${medPct}%\n` +
      `Aderência geral: ${taskPct}%\n` +
      `Eventos de saída: ${cur.breachCount}\n\n` +
      `${insight}`;
    try {
      await Share.share({ message: msg, title: `Relatório Aurélia ${label}` });
    } catch {
      Alert.alert('Exportar', 'Não foi possível compartilhar o relatório.');
    }
  }, [curWeek, cur, insight]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.rScrollContent} showsVerticalScrollIndicator={false}>

      {/* ── Week selector ── */}
      <View style={styles.rWeekRow}>
        <TouchableOpacity
          onPress={() => setWeekIdx((i) => i - 1)}
          disabled={weekIdx === 0}
          style={[styles.rWeekArrow, weekIdx === 0 && styles.rWeekArrowDisabled]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <IconSymbol name="chevron.left" size={18} color={weekIdx === 0 ? Colors.tabInactive : Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.rWeekLabel}>{weekLabel(curWeek)}</Text>
        <TouchableOpacity
          onPress={() => setWeekIdx((i) => i + 1)}
          disabled={weekIdx === weeks.length - 1}
          style={[styles.rWeekArrow, weekIdx === weeks.length - 1 && styles.rWeekArrowDisabled]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <IconSymbol name="chevron.right" size={18} color={weekIdx === weeks.length - 1 ? Colors.tabInactive : Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Aurélia insight card ── */}
      <View style={styles.rAureliaCard}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/aurelia')}>
        <View style={styles.rAureliaHeader}>
          <View style={styles.aureliaAvatar}>
            <Text style={styles.aureliaAvatarText}>A</Text>
          </View>
          <View>
            <Text style={styles.rAureliaName}>Aurélia</Text>
            <Text style={styles.rAureliaSub}>Análise semanal</Text>
          </View>
        </View>
        <Text style={styles.rAureliaText}>{insight}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Summary stats ── */}
      <View style={styles.rStatsRow}>
        {/* Medication adherence */}
        <View style={styles.rStatBox}>
          <Text style={styles.rStatValue}>{Math.round(cur.medAdherence * 100)}%</Text>
          <Text style={styles.rStatLabel}>Medicamentos</Text>
          <DeltaBadge current={cur.medAdherence} previous={prev?.medAdherence} />
        </View>
        {/* Task adherence */}
        <View style={[styles.rStatBox, styles.rStatBoxMid]}>
          <Text style={styles.rStatValue}>{Math.round(cur.taskAdherence * 100)}%</Text>
          <Text style={styles.rStatLabel}>Tarefas gerais</Text>
          <DeltaBadge current={cur.taskAdherence} previous={prev?.taskAdherence} />
        </View>
        {/* Geo-fence events */}
        <View style={styles.rStatBox}>
          <Text style={[styles.rStatValue, cur.breachCount > 0 && styles.rStatValueDanger]}>
            {cur.breachCount}
          </Text>
          <Text style={styles.rStatLabel}>Saídas zona</Text>
          {prev != null && (
            <Text style={styles.rDeltaFlat}>
              {cur.breachCount === prev.breachCount
                ? '= estável'
                : cur.breachCount < prev.breachCount
                ? `▲ melhora`
                : `▼ piora`}
            </Text>
          )}
        </View>
      </View>

      {/* ── Day-by-day chart ── */}
      <View style={styles.rCard}>
        <Text style={styles.rCardTitle}>Dia a dia</Text>
        {curWeek.map((day) => {
          const allDayEvents   = day.events.filter((e) => e.type !== 'breach');
          const doneCount      = allDayEvents.filter((e) => e.type === 'done').length;
          const missedCount    = allDayEvents.filter((e) => e.type === 'missed').length;
          const breachCount    = day.events.filter((e) => e.type === 'breach').length;
          const total          = allDayEvents.length;
          const pct            = total > 0 ? doneCount / total : 0;

          return (
            <View key={day.date} style={styles.rDayRow}>
              <View style={styles.rDayLabelCol}>
                <Text style={styles.rDayName}>{day.label}</Text>
                <Text style={styles.rDayNum}>{day.dayNum}</Text>
              </View>
              <View style={styles.rBarCol}>
                <View style={styles.rBarBg}>
                  <View style={[styles.rBarFill, { width: `${pct * 100}%` as `${number}%` }]} />
                </View>
                <View style={styles.rDayBadges}>
                  {missedCount > 0 && (
                    <View style={styles.rBadgeMissed}>
                      <Text style={styles.rBadgeText}>{missedCount} perdida{missedCount > 1 ? 's' : ''}</Text>
                    </View>
                  )}
                  {breachCount > 0 && (
                    <View style={styles.rBadgeBreach}>
                      <Text style={styles.rBadgeText}>saída</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.rDayCount}>{doneCount}/{total}</Text>
            </View>
          );
        })}
      </View>

      {/* ── Medication breakdown ── */}
      <View style={styles.rCard}>
        <Text style={styles.rCardTitle}>Aderência por medicamento</Text>
        {Object.entries(cur.medByName)
          .sort(([, a], [, b]) => a.done / a.total - b.done / b.total)
          .map(([name, { done, total }]) => {
            const pct    = total > 0 ? done / total : 0;
            const pctInt = Math.round(pct * 100);
            const barColor =
              pctInt >= 90 ? Colors.successText :
              pctInt >= 75 ? Colors.warningText :
              Colors.dangerText;
            return (
              <View key={name} style={styles.rMedRow}>
                <Text style={styles.rMedName} numberOfLines={1}>{name}</Text>
                <View style={styles.rMedBarWrap}>
                  <View style={[styles.rMedBarFill, { width: `${pct * 100}%` as `${number}%`, backgroundColor: barColor }]} />
                </View>
                <Text style={[styles.rMedPct, { color: barColor }]}>{pctInt}%</Text>
              </View>
            );
          })}
      </View>

      {/* ── Export / Share ── */}
      <TouchableOpacity style={styles.rExportBtn} onPress={handleExport} activeOpacity={0.85}>
        <IconSymbol name="square.and.arrow.up" size={18} color={Colors.white} />
        <Text style={styles.rExportText}>Exportar relatório</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// Dev state switcher — visible only in development, lets professor see all states
function DevStateSwitcher({
  current,
  onChange,
}: {
  current: ScreenState;
  onChange: (s: ScreenState) => void;
}) {
  if (process.env.NODE_ENV === 'production') return null;

  const states: { key: ScreenState; label: string }[] = [
    { key: 'normal', label: 'Normal' },
    { key: 'missed', label: 'Perdida' },
    { key: 'breach', label: 'Saída' },
  ];

  return (
    <View style={styles.devSwitcher}>
      <Text style={styles.devSwitcherLabel}>Demo:</Text>
      {states.map((s) => (
        <TouchableOpacity
          key={s.key}
          onPress={() => onChange(s.key)}
          style={[styles.devBtn, current === s.key && styles.devBtnActive]}
        >
          <Text style={[styles.devBtnText, current === s.key && styles.devBtnTextActive]}>
            {s.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { elder, tasks, geoFenceStatus, triggerBreach, resolveBreach, markTaskDone, undoTaskDone, weeks } = useApp();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('hoje');

  // Compute screen state from context
  const counts = countTasksByStatus(tasks);
  const missedTasks = tasks.filter((t) => t.status === 'missed');
  const currentTask = getCurrentTask(tasks);

  // Dev override for demo — defaults to whatever context says
  const [devOverride, setDevOverride] = useState<ScreenState | null>(null);

  const screenState: ScreenState =
    devOverride ??
    (geoFenceStatus === 'outside'
      ? 'breach'
      : missedTasks.length > 0
      ? 'missed'
      : 'normal');

  // ── Undo snackbar state ──────────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState<{ id: string; name: string } | null>(null);
  const snackbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSnackbar = useCallback((id: string, name: string) => {
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    setSnackbar({ id, name });
    snackbarTimer.current = setTimeout(() => setSnackbar(null), 5000);
  }, []);

  const handleUndoSnackbar = useCallback(() => {
    if (!snackbar) return;
    undoTaskDone(snackbar.id);
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    setSnackbar(null);
  }, [snackbar, undoTaskDone]);

  // Sync dev override to context
  const handleDevChange = useCallback(
    (s: ScreenState) => {
      setDevOverride(s);
      if (s === 'breach') triggerBreach();
      else resolveBreach();
    },
    [triggerBreach, resolveBreach],
  );

  const handleBreachPress = useCallback(() => {
    router.push('/geo-fence-breach');
  }, [router]);

  const handleMarkDone = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      markTaskDone(id);
      if (task) showSnackbar(id, task.name);
    },
    [markTaskDone, showSnackbar, tasks],
  );

  const firstMissed = missedTasks[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Teal header section */}
      <View style={styles.headerSection}>
        <HeaderBar
          elderName={elder.name}
          screenState={screenState}
          missedCount={missedTasks.length}
        />
        <TabPills active={activeTab} onChange={setActiveTab} />
      </View>

      {/* ── Relatórios view ── */}
      {activeTab === 'relatorios' && <RelatoriosView weeks={weeks} />}

      {/* ── Hoje view ── */}
      {activeTab === 'hoje' && (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Alert banner */}
        <AlertBanner
          screenState={screenState}
          missedTaskName={firstMissed?.name}
          missedTaskTime={firstMissed?.time}
          onBreachPress={handleBreachPress}
        />

        {/* Right now card */}
        <View>
          <Text style={styles.sectionLabel}>Agora</Text>
          <RightNowCard
            task={currentTask}
            screenState={screenState}
            counts={counts}
            onMarkDone={handleMarkDone}
            onBreachPress={handleBreachPress}
          />
        </View>

        {/* Timeline */}
        <TimelineScroll tasks={tasks} />

        {/* Aurélia insight */}
        <AureliaCard screenState={screenState} missedCount={missedTasks.length} />

        {/* Bottom padding for tab bar */}
        <View style={{ height: 16 }} />
      </ScrollView>
      )}

      {/* ── Undo snackbar (absolutely positioned, visible over both tabs) ── */}
      {snackbar && (
        <View style={styles.snackbar} pointerEvents="box-none">
          <Text style={styles.snackbarText} numberOfLines={1}>
            ✓ {snackbar.name.split(' ').slice(0, 3).join(' ')} confirmada
          </Text>
          <TouchableOpacity onPress={handleUndoSnackbar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.snackbarUndo}>Desfazer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Dev state switcher (only on Hoje) */}
      {activeTab === 'hoje' && (
        <DevStateSwitcher current={screenState} onChange={handleDevChange} />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primary,
  },

  // ── Header section (teal) ─────────────────────────────────────────────────
  headerSection: {
    backgroundColor: Colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  headerName: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.primaryLight,
  },
  headerSub: {
    fontSize: Typography.size.xs,
    color: '#9FE1CB',
    marginTop: 2,
  },

  // Status badge
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeOk: {
    backgroundColor: '#085041',
  },
  badgeAlert: {
    backgroundColor: '#793F00',
  },
  badgeDanger: {
    backgroundColor: '#501313',
  },
  badgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
  },
  // badge text colors per state (applied same object as badge bg via spread)
  // We override color directly in JSX via style prop

  // Tab pills
  tabPillsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  tabPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  tabPillActive: {
    backgroundColor: Colors.primaryLight,
  },
  tabPillText: {
    fontSize: Typography.size.xs,
    color: '#9FE1CB',
  },
  tabPillTextActive: {
    color: '#0F6E56',
    fontWeight: Typography.weight.semibold,
  },

  // ── Scroll content ─────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // Section label
  sectionLabel: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    letterSpacing: 0.6,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },

  // ── Alert banners ──────────────────────────────────────────────────────────
  alertBannerAmber: {
    backgroundColor: Colors.warningBg,
    borderWidth: 0.5,
    borderColor: Colors.warningBorder,
    borderRadius: Radius.md,
    padding: Spacing.sm + 1,
  },
  alertBannerRed: {
    backgroundColor: Colors.dangerBg,
    borderWidth: 0.5,
    borderColor: Colors.dangerBorder,
    borderRadius: Radius.md,
    padding: Spacing.sm + 1,
  },
  alertBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  alertBannerText: {
    fontSize: Typography.size.sm,
    color: Colors.warningText,
    lineHeight: 18,
    flex: 1,
  },
  alertBannerBold: {
    fontWeight: Typography.weight.semibold,
  },

  // ── Card (shared) ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  cardBreach: {
    borderColor: Colors.dangerBorder,
    backgroundColor: Colors.dangerBg,
  },

  // Task card header
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  taskTitle: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  taskDesc: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    marginBottom: 6,
  },

  // Progress bar
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  progressBg: {
    flex: 1,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.progressBg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  progressLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
  },

  // Geo row
  geoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: Colors.borderLight,
    marginTop: 4,
  },
  geoLabel: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },

  // Chips
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  chipText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
  },
  chipPending: {
    backgroundColor: Colors.primaryLight,
  },
  chipPendingText: {
    color: Colors.primaryText,
  },
  chipOverdue: {
    backgroundColor: Colors.warningBg,
  },
  chipOverdueText: {
    color: Colors.warningText,
  },
  chipDanger: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.dangerBorder,
  },
  chipDangerText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.white,
  },
  chipGeoOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.successBg,
  },
  chipGeoOkText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.successText,
  },

  // Buttons inside card
  btnMarkDone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 10,
    marginTop: 4,
  },
  btnMarkDoneText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.white,
  },
  btnBreachDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.dangerText,
    borderRadius: Radius.md,
    paddingVertical: 10,
    marginTop: 6,
  },
  btnBreachDetailText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.white,
  },

  // ── Timeline ───────────────────────────────────────────────────────────────
  timelineRow: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  timelineItem: {
    minWidth: 62,
    padding: Spacing.sm,
    paddingHorizontal: 6,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.white,
    alignItems: 'center',
    gap: 4,
  },
  tlTime: {
    fontSize: 9,
    color: Colors.textSecondary,
  },
  tlDot: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlDotText: {
    fontSize: 10,
    fontWeight: Typography.weight.bold,
  },
  tlLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 12,
  },

  // ── Aurélia card ───────────────────────────────────────────────────────────
  aureliaCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.aureliaBorder,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  aureliaAvatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.aureliaBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  aureliaAvatarText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.bold,
    color: Colors.aureliaText,
  },
  aureliaName: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.aureliaText,
    marginBottom: 2,
  },
  aureliaInsight: {
    fontSize: Typography.size.sm,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  aureliaFlag: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.warningBg,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  aureliaFlagDanger: {
    backgroundColor: Colors.dangerBg,
  },
  aureliaFlagText: {
    fontSize: 9,
    color: Colors.warningText,
  },
  aureliaFlagTextDanger: {
    color: Colors.dangerText,
  },

  // ── Badge text colors ──────────────────────────────────────────────────────
  badgeTextOk: { color: '#9FE1CB' },
  badgeTextAlert: { color: '#FAC775' },
  badgeTextDanger: { color: '#F09595' },

  // ── Dev switcher ───────────────────────────────────────────────────────────
  devSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  devSwitcherLabel: {
    fontSize: 9,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: '#2a2a3e',
  },
  devBtnActive: {
    backgroundColor: Colors.primary,
  },
  devBtnText: {
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
  },
  devBtnTextActive: {
    color: Colors.white,
  },

  // ── Relatórios view ────────────────────────────────────────────────────────
  rScrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // Week selector
  rWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rWeekLabel: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  rWeekArrow: { padding: 4 },
  rWeekArrowDisabled: { opacity: 0.3 },

  // Aurélia insight card
  rAureliaCard: {
    backgroundColor: Colors.aureliaBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.aureliaBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  rAureliaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rAureliaName: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
    color: Colors.aureliaText,
  },
  rAureliaSub: {
    fontSize: Typography.size.xs,
    color: Colors.aureliaText,
    opacity: 0.7,
  },
  rAureliaText: {
    fontSize: Typography.size.sm,
    color: Colors.aureliaText,
    lineHeight: 20,
  },

  // Summary stats row
  rStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  rStatBox: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 3,
  },
  rStatBoxMid: {
    borderColor: Colors.primaryLight,
    borderWidth: 1,
  },
  rStatValue: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  rStatValueDanger: {
    color: Colors.dangerText,
  },
  rStatLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  rDelta: {
    fontSize: 10,
    fontWeight: Typography.weight.semibold,
  },
  rDeltaUp:   { color: Colors.successText },
  rDeltaDown: { color: Colors.dangerText },
  rDeltaFlat: {
    fontSize: 10,
    color: Colors.textSecondary,
  },

  // Generic card
  rCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  rCardTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },

  // Day-by-day chart
  rDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rDayLabelCol: {
    width: 32,
    alignItems: 'center',
  },
  rDayName: {
    fontSize: 10,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
  rDayNum: {
    fontSize: 12,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  rBarCol: {
    flex: 1,
    gap: 3,
  },
  rBarBg: {
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  rBarFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  rDayBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  rBadgeMissed: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  rBadgeBreach: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  rBadgeText: {
    fontSize: 9,
    color: Colors.textPrimary,
    fontWeight: Typography.weight.semibold,
  },
  rDayCount: {
    fontSize: 11,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
    width: 30,
    textAlign: 'right',
  },

  // Medication breakdown
  rMedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rMedName: {
    fontSize: Typography.size.xs,
    color: Colors.textPrimary,
    width: 130,
  },
  rMedBarWrap: {
    flex: 1,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  rMedBarFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  rMedPct: {
    fontSize: 11,
    fontWeight: Typography.weight.bold,
    width: 34,
    textAlign: 'right',
  },

  // Export button
  rExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 13,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  rExportText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.white,
  },

  // ── Undo snackbar ──────────────────────────────────────────────────────────
  snackbar: {
    position: 'absolute',
    bottom: 80, // above tab bar
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: '#1A1A2E',
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  snackbarText: {
    fontSize: Typography.size.sm,
    color: Colors.white,
    flex: 1,
  },
  snackbarUndo: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
    color: Colors.primaryLight,
    marginLeft: Spacing.md,
  },
});
