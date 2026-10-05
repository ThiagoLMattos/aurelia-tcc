/**
 * Aurélia — Histórico tab
 *
 * Week strip → filter chips → summary bar → entry list with inline expand.
 * Selecting a day filters the entry list (the API is asked for that day and event types only);
 * tapping an entry expands it in place. Pull down to refresh.
 */

import {
  addDays,
  LABELS_PT,
  memoryAccuracyPct,
  weekDates,
  weekStartOf,
  type Event,
  type EventType,
  type LocalDate,
} from '@aurelia/shared';
import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, LoadingState } from '@/components';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { friendlyError } from '@/lib/errors';
import { clockTime, dayOfMonth, mapsUrl, weekRange } from '@/lib/format';
import { useCurrentElder, useEvents, useToday, useWeeklyReport } from '@/queries';
import { Colors, Radius, Spacing, Typography } from '@/theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'done' | 'missed' | 'zone' | 'sos' | 'games';

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTERS: { key: FilterKey; label: string; types?: EventType[] }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'done', label: 'Concluídas', types: ['taskDone'] },
  { key: 'missed', label: 'Perdidas', types: ['taskMissed'] },
  { key: 'zone', label: 'Zona segura', types: ['geofenceExit', 'geofenceReturn'] },
  { key: 'sos', label: 'SOS', types: ['sos'] },
  { key: 'games', label: 'Jogos', types: ['gamePlayed'] },
];

const WEEKDAY_INITIALS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const EMPTY_MESSAGES: Record<FilterKey, string> = {
  all: 'Nenhum evento registrado neste dia.',
  done: 'Nenhuma tarefa concluída neste dia.',
  missed: 'Nenhuma tarefa perdida neste dia.',
  zone: 'Nenhuma saída da zona segura neste dia.',
  sos: 'Nenhum SOS neste dia.',
  games: 'Nenhum jogo neste dia.',
};

// ─── Event presentation ───────────────────────────────────────────────────────

type Tone = { dotBg: string; dotColor: string; icon: string };

const SUCCESS: Tone = { dotBg: Colors.successBg, dotColor: Colors.successText, icon: '✓' };
const WARNING: Tone = { dotBg: Colors.warningBg, dotColor: Colors.warningText, icon: '✕' };
const DANGER: Tone = { dotBg: Colors.dangerBg, dotColor: Colors.dangerText, icon: '!' };
const GAME: Tone = { dotBg: Colors.primaryLight, dotColor: Colors.primary, icon: '★' };

interface Row {
  label: string;
  value: string;
  danger?: boolean;
}

interface Presentation {
  tone: Tone;
  title: string;
  summary: string;
  rows: Row[];
  /** A link row, for events that carry a position. */
  map?: { lat: number; lng: number };
  note?: string;
}

function presentEvent(event: Event, timezone: string): Presentation {
  const at = clockTime(event.at, timezone);
  switch (event.type) {
    case 'taskDone': {
      const { payload } = event;
      const who = payload.doneBy === 'elder' ? 'pelo idoso' : 'por você';
      return {
        tone: SUCCESS,
        title: payload.routineName,
        summary: `Confirmada ${who}`,
        rows: [
          { label: 'Horário programado', value: payload.scheduledTime },
          { label: 'Confirmada às', value: at },
          { label: 'Confirmada', value: payload.doneBy === 'elder' ? 'Pelo idoso' : 'Por um cuidador' },
        ],
        note: payload.undoneAt ? `Confirmação desfeita às ${clockTime(payload.undoneAt, timezone)}.` : undefined,
      };
    }
    case 'taskMissed':
      return {
        tone: WARNING,
        title: event.payload.routineName,
        summary: 'Não confirmada no prazo',
        rows: [
          { label: 'Horário programado', value: event.payload.scheduledTime },
          { label: 'Marcada como perdida às', value: at, danger: true },
        ],
      };
    case 'sos': {
      const { lat, lng } = event.payload;
      const hasPosition = lat !== null && lng !== null;
      return {
        tone: DANGER,
        title: 'SOS acionado',
        summary: hasPosition ? 'Com localização' : 'Sem localização',
        rows: [{ label: 'Acionado às', value: at, danger: true }],
        map: hasPosition ? { lat, lng } : undefined,
      };
    }
    case 'geofenceExit': {
      const { payload } = event;
      return {
        tone: DANGER,
        title: 'Saiu da zona segura',
        summary: payload.resolvedAt ? 'Confirmado como seguro' : 'Ainda não resolvido',
        rows: [
          { label: 'Saída detectada às', value: at },
          { label: 'Distância do centro', value: `${Math.round(payload.distanceM)} m` },
          payload.resolvedAt
            ? { label: 'Resolvida às', value: clockTime(payload.resolvedAt, timezone) }
            : { label: 'Resolvida às', value: 'Não resolvida', danger: true },
        ],
        map: { lat: payload.lat, lng: payload.lng },
        note: payload.resolvedNote ?? undefined,
      };
    }
    case 'geofenceReturn':
      return {
        tone: SUCCESS,
        title: 'Voltou à zona segura',
        summary: 'De volta ao raio seguro',
        rows: [{ label: 'Retorno detectado às', value: at }],
        map: { lat: event.payload.lat, lng: event.payload.lng },
      };
    case 'deviceOffline':
      return {
        tone: WARNING,
        title: 'Rastreador sem sinal',
        summary: 'O rastreador parou de enviar a localização',
        rows: [
          { label: 'Detectado às', value: at, danger: true },
          {
            label: 'Último sinal',
            value: event.payload.lastSeenAt ? clockTime(event.payload.lastSeenAt, timezone) : 'Nunca',
          },
        ],
      };
    case 'devicePaired':
      return {
        tone: SUCCESS,
        title: 'Rastreador cadastrado',
        summary: event.payload.label,
        rows: [{ label: 'Cadastrado às', value: at }],
      };
    case 'gamePlayed': {
      const { payload } = event;
      const minutes = Math.max(1, Math.round(payload.durationSec / 60));
      const duration = { label: 'Duração', value: `${minutes} min` };
      if (payload.game === 'memory') {
        return {
          tone: GAME,
          title: LABELS_PT.game.memory,
          summary: `${payload.pairs} pares em ${payload.moves} jogadas`,
          rows: [
            { label: 'Terminado às', value: at },
            { label: 'Pares', value: String(payload.pairs) },
            { label: 'Jogadas', value: String(payload.moves) },
            { label: 'Acertos', value: `${memoryAccuracyPct(payload)}% das jogadas` },
            duration,
          ],
        };
      }
      if (payload.game === 'crossword') {
        const complete = payload.words === payload.totalWords;
        return {
          tone: GAME,
          title: `${LABELS_PT.game.crossword}: ${payload.theme}`,
          summary: complete
            ? `Completou as ${payload.totalWords} palavras`
            : `Encontrou ${payload.words} de ${payload.totalWords} palavras`,
          rows: [
            { label: 'Terminado às', value: at },
            { label: 'Palavras', value: `${payload.words} de ${payload.totalWords}` },
            { label: 'Dicas usadas', value: String(payload.hints) },
            duration,
          ],
        };
      }
      if (payload.game === 'tictactoe') {
        return {
          tone: GAME,
          title: LABELS_PT.game.tictactoe,
          summary:
            payload.outcome === 'win'
              ? 'Venceu o celular'
              : payload.outcome === 'draw'
                ? 'Empatou com o celular'
                : 'O celular venceu desta vez',
          rows: [
            { label: 'Terminado às', value: at },
            { label: 'Nível', value: LABELS_PT.ticTacToeLevel[payload.level] },
            { label: 'Resultado', value: LABELS_PT.ticTacToeOutcome[payload.outcome] },
            duration,
          ],
        };
      }
      return {
        tone: GAME,
        title: LABELS_PT.game.sequence,
        summary: `Lembrou ${payload.longest} ${payload.longest === 1 ? 'cor' : 'cores'} em sequência`,
        rows: [
          { label: 'Terminado às', value: at },
          { label: 'Maior sequência', value: `${payload.longest} ${payload.longest === 1 ? 'cor' : 'cores'}` },
          duration,
        ],
      };
    }
  }
}

// ─── Week strip ───────────────────────────────────────────────────────────────

interface DayCell {
  date: LocalDate;
  hasDone: boolean;
  hasMissed: boolean;
  hasAlert: boolean;
}

function WeekStrip({
  days,
  selectedDate,
  onSelect,
}: {
  days: DayCell[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  return (
    <View style={styles.weekStrip}>
      {days.map((day, index) => {
        const isSelected = day.date === selectedDate;
        return (
          <TouchableOpacity
            key={day.date}
            style={[styles.dayCell, isSelected && styles.dayCellSelected]}
            onPress={() => onSelect(day.date)}
            activeOpacity={0.75}
          >
            <Text style={[styles.dayName, isSelected && styles.dayCellTextSelected]}>
              {WEEKDAY_INITIALS[index]}
            </Text>
            <Text style={[styles.dayNum, isSelected && styles.dayCellTextSelected]}>
              {dayOfMonth(day.date)}
            </Text>
            {/* Status dots */}
            <View style={styles.dotRow}>
              {day.hasDone && <View style={[styles.miniDot, styles.miniDotDone]} />}
              {day.hasMissed && <View style={[styles.miniDot, styles.miniDotMissed]} />}
              {day.hasAlert && <View style={[styles.miniDot, styles.miniDotBreach]} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Summary stat bar ─────────────────────────────────────────────────────────

function SummaryBar({ done, missed, alerts }: { done: number; missed: number; alerts: number }) {
  return (
    <View style={styles.summaryBar}>
      <View style={[styles.statBox, { backgroundColor: Colors.successBg }]}>
        <Text style={[styles.statNum, { color: Colors.successText }]}>{done}</Text>
        <Text style={[styles.statLabel, { color: Colors.successText }]}>Concluídas</Text>
      </View>
      <View style={[styles.statBox, { backgroundColor: Colors.warningBg }]}>
        <Text style={[styles.statNum, { color: Colors.warningText }]}>{missed}</Text>
        <Text style={[styles.statLabel, { color: Colors.warningText }]}>Perdidas</Text>
      </View>
      <View style={[styles.statBox, { backgroundColor: Colors.dangerBg }]}>
        <Text style={[styles.statNum, { color: Colors.dangerText }]}>{alerts}</Text>
        <Text style={[styles.statLabel, { color: Colors.dangerText }]}>Saídas e SOS</Text>
      </View>
    </View>
  );
}

// ─── Entry card (collapsible) ─────────────────────────────────────────────────

function EntryCard({
  event,
  timezone,
  expanded,
  onToggle,
}: {
  event: Event;
  timezone: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const view = presentEvent(event, timezone);

  return (
    <TouchableOpacity
      style={styles.entryCard}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      {/* Collapsed row */}
      <View style={styles.entryRow}>
        {/* Status dot */}
        <View style={[styles.entryDot, { backgroundColor: view.tone.dotBg }]}>
          <Text style={[styles.entryDotText, { color: view.tone.dotColor }]}>{view.tone.icon}</Text>
        </View>

        {/* Content */}
        <View style={styles.entryContent}>
          <View style={styles.entryTopRow}>
            <Text style={styles.entryTitle} numberOfLines={1}>{view.title}</Text>
            <Text style={styles.entryTime}>{clockTime(event.at, timezone)}</Text>
          </View>
          <Text style={styles.entrySummary} numberOfLines={expanded ? undefined : 1}>
            {view.summary}
          </Text>
        </View>

        {/* Chevron */}
        <IconSymbol
          name="chevron.right"
          size={14}
          color={Colors.textSecondary}
          style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
        />
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.entryDetail}>
          <View style={styles.detailDivider} />
          {view.rows.map((row, index) => (
            <DetailRow
              key={row.label}
              label={row.label}
              value={row.value}
              danger={row.danger}
              last={index === view.rows.length - 1 && !view.note && !view.map}
            />
          ))}
          {view.map && (
            <TouchableOpacity
              style={extra.mapLink}
              onPress={() => void Linking.openURL(mapsUrl(view.map!.lat, view.map!.lng))}
              accessibilityRole="link"
            >
              <IconSymbol name="map.fill" size={12} color={Colors.primary} />
              <Text style={extra.mapLinkText}>Abrir no mapa</Text>
            </TouchableOpacity>
          )}
          {view.note ? (
            <View style={styles.occurrenceNote}>
              <IconSymbol name="exclamationmark.triangle.fill" size={11} color={Colors.warningText} />
              <Text style={styles.occurrenceNoteText}>{view.note}</Text>
            </View>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

function DetailRow({
  label,
  value,
  danger,
  last,
}: {
  label: string;
  value: string;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, danger && { color: Colors.dangerText }]}>{value}</Text>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyDay({ filter }: { filter: FilterKey }) {
  return (
    <View style={styles.emptyWrap}>
      <IconSymbol name="checkmark.circle.fill" size={32} color={Colors.successText} />
      <Text style={styles.emptyText}>{EMPTY_MESSAGES[filter]}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HistoricoScreen() {
  const elder = useCurrentElder();
  const today = useToday(elder);
  const thisWeek = weekStartOf(today);

  const [weekStart, setWeekStart] = useState<LocalDate | null>(null);
  const [pickedDate, setPickedDate] = useState<LocalDate | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const shownWeek = weekStart ?? thisWeek;
  const isCurrentWeek = shownWeek >= thisWeek;
  const dates = useMemo(() => weekDates(shownWeek), [shownWeek]);
  const selectedDate = pickedDate && dates.includes(pickedDate) ? pickedDate : isCurrentWeek ? today : (dates[6] ?? shownWeek);

  const report = useWeeklyReport(elder.id, shownWeek);
  const types = FILTERS.find((f) => f.key === filter)?.types;
  const events = useEvents(elder.id, { from: selectedDate, to: selectedDate, types });

  const days = useMemo<DayCell[]>(
    () =>
      dates.map((date) => {
        const day = report.data?.days.find((d) => d.date === date);
        return {
          date,
          hasDone: (day?.done ?? 0) > 0,
          hasMissed: (day?.missed ?? 0) > 0,
          hasAlert: (day?.geofenceExits ?? 0) + (day?.sos ?? 0) > 0,
        };
      }),
    [dates, report.data],
  );
  const selectedDay = report.data?.days.find((d) => d.date === selectedDate);
  const items = events.data?.pages.flatMap((page) => page.items) ?? [];

  const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const handleDaySelect = useCallback((date: string) => {
    animate();
    setPickedDate(date);
    setExpandedId(null);
  }, []);

  const handleFilterChange = useCallback((key: FilterKey) => {
    animate();
    setFilter(key);
    setExpandedId(null);
  }, []);

  const handleToggleEntry = useCallback((id: string) => {
    animate();
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const moveWeek = useCallback(
    (direction: -1 | 1) => {
      const next = addDays(shownWeek, direction * 7);
      setWeekStart(next >= thisWeek ? null : next);
      setPickedDate(null);
      setExpandedId(null);
    },
    [shownWeek, thisWeek],
  );

  const refreshing = (events.isRefetching && !events.isFetchingNextPage) || report.isRefetching;
  const refresh = useCallback(() => {
    void events.refetch();
    void report.refetch();
  }, [events, report]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Histórico</Text>
        <View style={extra.weekNav}>
          <TouchableOpacity onPress={() => moveWeek(-1)} hitSlop={12} accessibilityLabel="Semana anterior">
            <IconSymbol name="chevron.left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={extra.weekLabel}>{weekRange(shownWeek, dates[6] ?? shownWeek)}</Text>
          <TouchableOpacity
            onPress={() => moveWeek(1)}
            disabled={isCurrentWeek}
            hitSlop={12}
            accessibilityLabel="Próxima semana"
            style={isCurrentWeek && { opacity: 0.3 }}
          >
            <IconSymbol name="chevron.right" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Week strip */}
      <View style={styles.weekStripWrap}>
        <WeekStrip days={days} selectedDate={selectedDate} onSelect={handleDaySelect} />
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => handleFilterChange(f.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Summary bar */}
      <SummaryBar
        done={selectedDay?.done ?? 0}
        missed={selectedDay?.missed ?? 0}
        alerts={(selectedDay?.geofenceExits ?? 0) + (selectedDay?.sos ?? 0)}
      />

      {/* Entry list */}
      {events.isPending ? (
        <LoadingState />
      ) : events.isError ? (
        <ErrorState message={friendlyError(events.error)} onRetry={() => void events.refetch()} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          {items.length === 0 ? (
            <EmptyDay filter={filter} />
          ) : (
            items.map((event) => (
              <EntryCard
                key={event.id}
                event={event}
                timezone={elder.timezone}
                expanded={expandedId === event.id}
                onToggle={() => handleToggleEntry(event.id)}
              />
            ))
          )}
          {events.hasNextPage ? (
            <TouchableOpacity
              style={extra.loadMore}
              onPress={() => void events.fetchNextPage()}
              disabled={events.isFetchingNextPage}
              accessibilityRole="button"
            >
              <Text style={extra.loadMoreText}>{events.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}</Text>
            </TouchableOpacity>
          ) : null}
          <View style={{ height: Spacing.lg }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const extra = StyleSheet.create({
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  weekLabel: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: Colors.textPrimary, minWidth: 84, textAlign: 'center' },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm },
  mapLinkText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: Colors.primary },
  loadMore: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  loadMoreText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: Colors.primary },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },

  // Week strip
  weekStripWrap: {
    backgroundColor: Colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
    paddingBottom: Spacing.sm,
  },
  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    gap: 3,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    gap: 2,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayCellTextSelected: {
    color: Colors.white,
  },
  dayName: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.medium,
  },
  dayNum: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 2,
    height: 5,
    alignItems: 'center',
  },
  miniDot: {
    width: 4,
    height: 4,
    borderRadius: Radius.full,
  },
  miniDotDone:   { backgroundColor: Colors.successBorder },
  miniDotMissed: { backgroundColor: Colors.warningBorder },
  miniDotBreach: { backgroundColor: Colors.dangerDot },

  // Filter chips
  filterScroll: {
    backgroundColor: Colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
    maxHeight: 48,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 6,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.white,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.medium,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontWeight: Typography.weight.semibold,
  },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  statBox: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statNum: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },

  // Entry card
  entryCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  entryDot: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  entryDotText: {
    fontSize: 12,
    fontWeight: Typography.weight.bold,
  },
  entryContent: {
    flex: 1,
    gap: 2,
  },
  entryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  entryTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  entryTime: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    flexShrink: 0,
  },
  entrySummary: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  // Expanded detail
  entryDetail: {
    marginTop: Spacing.sm,
  },
  detailDivider: {
    height: 0.5,
    backgroundColor: Colors.borderLight,
    marginBottom: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
  },
  detailLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  occurrenceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.sm,
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  occurrenceNoteText: {
    fontSize: Typography.size.xs,
    color: Colors.warningText,
    fontWeight: Typography.weight.medium,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
