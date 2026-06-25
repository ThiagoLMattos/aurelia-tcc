/**
 * Aurélia — Histórico tab
 *
 * Week strip → filter chips → summary bar → entry list with inline expand.
 * Selecting a day filters the entry list. Tapping an entry expands it in-place.
 * No navigation to new screens — everything lives here per spec.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { DayHistory, HistoryEvent } from '@/data/mock';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'done' | 'missed' | 'breach';

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',    label: 'Todos' },
  { key: 'done',   label: 'Concluídas' },
  { key: 'missed', label: 'Perdidas' },
  { key: 'breach', label: 'Geo-fence' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_CONFIG = {
  done: {
    dotBg:    Colors.successBg,
    dotColor: Colors.successText,
    icon:     '✓',
    label:    'Concluída',
  },
  missed: {
    dotBg:    Colors.warningBg,
    dotColor: Colors.warningText,
    icon:     '✕',
    label:    'Perdida',
  },
  breach: {
    dotBg:    Colors.dangerBg,
    dotColor: Colors.dangerText,
    icon:     '!',
    label:    'Saída detectada',
  },
} as const;

// ─── Week strip ───────────────────────────────────────────────────────────────

function WeekStrip({
  days,
  selectedDate,
  onSelect,
}: {
  days: DayHistory[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  return (
    <View style={styles.weekStrip}>
      {days.map((day) => {
        const isSelected = day.date === selectedDate;
        return (
          <TouchableOpacity
            key={day.date}
            style={[styles.dayCell, isSelected && styles.dayCellSelected]}
            onPress={() => onSelect(day.date)}
            activeOpacity={0.75}
          >
            <Text style={[styles.dayName, isSelected && styles.dayCellTextSelected]}>
              {day.label}
            </Text>
            <Text style={[styles.dayNum, isSelected && styles.dayCellTextSelected]}>
              {day.dayNum}
            </Text>
            {/* Status dots */}
            <View style={styles.dotRow}>
              {day.hasDone   && <View style={[styles.miniDot, styles.miniDotDone]} />}
              {day.hasMissed && <View style={[styles.miniDot, styles.miniDotMissed]} />}
              {day.hasBreach && <View style={[styles.miniDot, styles.miniDotBreach]} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Summary stat bar ─────────────────────────────────────────────────────────

function SummaryBar({ events }: { events: HistoryEvent[] }) {
  const done   = events.filter((e) => e.type === 'done').length;
  const missed = events.filter((e) => e.type === 'missed').length;
  const breach = events.filter((e) => e.type === 'breach').length;

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
        <Text style={[styles.statNum, { color: Colors.dangerText }]}>{breach}</Text>
        <Text style={[styles.statLabel, { color: Colors.dangerText }]}>Saídas</Text>
      </View>
    </View>
  );
}

// ─── Entry card (collapsible) ─────────────────────────────────────────────────

function EntryCard({
  event,
  expanded,
  onToggle,
}: {
  event: HistoryEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cfg = EVENT_CONFIG[event.type];

  return (
    <TouchableOpacity
      style={styles.entryCard}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      {/* Collapsed row */}
      <View style={styles.entryRow}>
        {/* Status dot */}
        <View style={[styles.entryDot, { backgroundColor: cfg.dotBg }]}>
          <Text style={[styles.entryDotText, { color: cfg.dotColor }]}>{cfg.icon}</Text>
        </View>

        {/* Content */}
        <View style={styles.entryContent}>
          <View style={styles.entryTopRow}>
            <Text style={styles.entryTitle} numberOfLines={1}>{event.title}</Text>
            <Text style={styles.entryTime}>{event.time}</Text>
          </View>
          <Text style={styles.entrySummary} numberOfLines={expanded ? undefined : 1}>
            {event.summary}
          </Text>
        </View>

        {/* Chevron */}
        <IconSymbol
          name={expanded ? 'chevron.right' : 'chevron.right'}
          size={14}
          color={Colors.textSecondary}
          style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
        />
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.entryDetail}>
          <View style={styles.detailDivider} />

          {event.type === 'breach' ? (
            <>
              <DetailRow label="Saída detectada" value={event.detectedTime ?? '—'} />
              <DetailRow label="Resolvida às"    value={event.resolvedTime ?? 'Não resolvida'} danger={!event.resolvedTime} />
              <DetailRow label="Distância"        value={event.distanceOutside ?? '—'} />
              <DetailRow label="Duração"          value={event.duration ?? '—'} last />
            </>
          ) : (
            <>
              <DetailRow label="Horário programado" value={event.scheduledTime ?? '—'} />
              {event.type === 'done' && (
                <DetailRow label="Confirmada às" value={event.confirmedTime ?? '—'} last={!event.occurrenceNote} />
              )}
              {event.type === 'missed' && (
                <DetailRow label="Status" value="Não confirmada" danger last={!event.occurrenceNote} />
              )}
              {event.occurrenceNote && (
                <View style={styles.occurrenceNote}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={11} color={Colors.warningText} />
                  <Text style={styles.occurrenceNoteText}>{event.occurrenceNote}</Text>
                </View>
              )}
            </>
          )}
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

function EmptyState({ filter }: { filter: FilterKey }) {
  const messages: Record<FilterKey, string> = {
    all:    'Nenhum evento registrado neste dia.',
    done:   'Nenhuma tarefa concluída neste dia.',
    missed: 'Nenhuma tarefa perdida neste dia.',
    breach: 'Nenhuma saída da zona segura neste dia.',
  };

  return (
    <View style={styles.emptyWrap}>
      <IconSymbol name="checkmark.circle.fill" size={32} color={Colors.successText} />
      <Text style={styles.emptyText}>{messages[filter]}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HistoricoScreen() {
  const { weekHistory } = useApp();

  // Default to last day in history (most recent)
  const [selectedDate, setSelectedDate] = useState(
    weekHistory[weekHistory.length - 1]?.date ?? '',
  );
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Selected day's data
  const selectedDay = useMemo(
    () => weekHistory.find((d) => d.date === selectedDate) ?? weekHistory[0],
    [weekHistory, selectedDate],
  );

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (!selectedDay) return [];
    if (filter === 'all') return selectedDay.events;
    return selectedDay.events.filter((e) => e.type === filter);
  }, [selectedDay, filter]);

  const handleDaySelect = useCallback((date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedDate(date);
    setExpandedId(null);
  }, []);

  const handleFilterChange = useCallback((key: FilterKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilter(key);
    setExpandedId(null);
  }, []);

  const handleToggleEntry = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Histórico</Text>
      </View>

      {/* Week strip */}
      <View style={styles.weekStripWrap}>
        <WeekStrip
          days={weekHistory}
          selectedDate={selectedDate}
          onSelect={handleDaySelect}
        />
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
      {selectedDay && <SummaryBar events={selectedDay.events} />}

      {/* Entry list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredEvents.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          filteredEvents.map((event) => (
            <EntryCard
              key={event.id}
              event={event}
              expanded={expandedId === event.id}
              onToggle={() => handleToggleEntry(event.id)}
            />
          ))
        )}
        <View style={{ height: Spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  // Header
  header: {
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
