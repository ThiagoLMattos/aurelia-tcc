/**
 * Aurélia — Rotinas tab
 * Lists the elder's routines grouped by type. Each card shows name, time, repeat summary and
 * reminder flags. The + button opens the routine builder; long-press or the bin removes a routine.
 */

import { LABELS_PT, type Routine, type RoutineType } from '@aurelia/shared';
import React, { useCallback, useMemo } from 'react';
import {
  Alert,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ErrorState, LoadingState } from '@/components';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { confirm } from '@/lib/confirm';
import { friendlyError } from '@/lib/errors';
import { firstName } from '@/lib/format';
import { useCurrentElder, useDeleteRoutine, useRoutines } from '@/queries';
import { Colors, Radius, Spacing, Typography } from '@/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_ORDER: RoutineType[] = ['medication', 'meal', 'activity', 'custom'];

const TYPE_CONFIG: Record<RoutineType, { icon: IconSymbolName; color: string; bg: string }> = {
  medication: { icon: 'pills.fill', color: Colors.primary, bg: Colors.primaryLight },
  meal:       { icon: 'fork.knife', color: '#7B5E3B', bg: '#FFF3E0' },
  activity:   { icon: 'figure.walk', color: Colors.successText, bg: Colors.successBg },
  custom:     { icon: 'star.fill', color: Colors.aureliaText, bg: Colors.aureliaBg },
};

function repeatSummary(days: number[]): string {
  if (days.length === 7) return 'Todos os dias';
  const sorted = [...days].sort((a, b) => a - b);
  if (JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])) return 'Dias úteis';
  return sorted.map((d) => LABELS_PT.weekdayShort[d]).join(', ');
}

// ─── Routine card ─────────────────────────────────────────────────────────────

function RoutineCard({
  routine,
  onEdit,
  onDelete,
}: {
  routine: Routine;
  onEdit: (id: string) => void;
  onDelete: (routine: Routine) => void;
}) {
  const cfg = TYPE_CONFIG[routine.type];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onEdit(routine.id)}
      onLongPress={() => onDelete(routine)}
      activeOpacity={0.85}
      accessibilityHint="Toque para editar, segure para remover"
    >
      {/* Left icon */}
      <View style={[styles.typeIconWrap, { backgroundColor: cfg.bg }]}>
        <IconSymbol name={cfg.icon} size={20} color={cfg.color} />
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName} numberOfLines={1}>{routine.name}</Text>
          <Text style={styles.cardTime}>{routine.time}</Text>
        </View>

        {routine.medication ? (
          <Text style={styles.cardSub}>{routine.medication.dosage} · {routine.medication.form}</Text>
        ) : routine.description ? (
          <Text style={styles.cardSub} numberOfLines={2}>{routine.description}</Text>
        ) : null}

        <Text style={styles.cardRepeat}>{repeatSummary(routine.weekdays)}</Text>

        {/* Reminder flags */}
        <View style={styles.flagRow}>
          {routine.remindElder && (
            <View style={styles.flagAurelia}>
              <Text style={styles.flagText}>Lembrete ao idoso</Text>
            </View>
          )}
          {routine.alertIfMissed && (
            <View style={styles.flagAlert}>
              <Text style={styles.flagAlertText}>Alerta se perdida</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          onPress={() => onEdit(routine.id)}
          style={styles.editBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Editar ${routine.name}`}
        >
          <IconSymbol name="pencil" size={15} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(routine)}
          style={styles.deleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Remover ${routine.name}`}
        >
          <IconSymbol name="trash" size={15} color={Colors.dangerText} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyRoutines({ name, onAdd }: { name: string; onAdd: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <IconSymbol name="list.bullet" size={32} color={Colors.tabInactive} />
      </View>
      <Text style={styles.emptyTitle}>Nenhuma rotina criada</Text>
      <Text style={styles.emptySub}>
        Adicione medicações, refeições e atividades para que Aurélia possa acompanhar o dia de {name}.
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onAdd} activeOpacity={0.85}>
        <IconSymbol name="plus" size={16} color={Colors.white} />
        <Text style={styles.emptyBtnText}>Criar primeira rotina</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RotinasScreen() {
  const elder = useCurrentElder();
  const routines = useRoutines(elder.id);
  const remove = useDeleteRoutine(elder.id);
  const router = useRouter();

  const items = useMemo(() => routines.data?.items ?? [], [routines.data]);
  const sections = useMemo(
    () =>
      TYPE_ORDER.map((type) => ({
        type,
        title: LABELS_PT.routineType[type],
        data: items.filter((r) => r.type === type).sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name)),
      })).filter((section) => section.data.length > 0),
    [items],
  );

  const handleAdd = useCallback(() => {
    router.push('/(caregiver)/routine-builder');
  }, [router]);

  const handleEdit = useCallback(
    (id: string) => {
      router.push({ pathname: '/(caregiver)/routine-builder', params: { id } });
    },
    [router],
  );

  const handleDelete = useCallback(
    async (routine: Routine) => {
      const ok = await confirm(
        'Remover rotina',
        `“${routine.name}” deixará de aparecer na agenda. O que já foi registrado continua no histórico.`,
        'Remover',
        true,
      );
      if (!ok) return;
      remove.mutate(routine.id, { onError: (error) => Alert.alert('Não foi possível remover', friendlyError(error)) });
    },
    [remove],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Rotinas</Text>
          <Text style={styles.headerSub}>
            {items.length} {items.length === 1 ? 'item' : 'itens'} configurados
          </Text>
        </View>
        <TouchableOpacity style={styles.headerAddBtn} onPress={handleAdd} activeOpacity={0.85} accessibilityLabel="Nova rotina">
          <IconSymbol name="plus" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* List */}
      {routines.isPending ? (
        <LoadingState />
      ) : routines.isError ? (
        <ErrorState message={friendlyError(routines.error)} onRetry={() => void routines.refetch()} />
      ) : items.length === 0 ? (
        <EmptyRoutines name={firstName(elder.name)} onAdd={handleAdd} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <RoutineCard routine={item} onEdit={handleEdit} onDelete={(r) => void handleDelete(r)} />}
          renderSectionHeader={({ section }) => <Text style={extra.sectionTitle}>{section.title}</Text>}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          refreshing={routines.isRefetching}
          onRefresh={() => void routines.refetch()}
        />
      )}

      {/* FAB */}
      {items.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={handleAdd} activeOpacity={0.85} accessibilityLabel="Nova rotina">
          <IconSymbol name="plus" size={24} color={Colors.white} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const extra = StyleSheet.create({
  sectionTitle: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    letterSpacing: 0.6,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
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
  headerSub: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  listContent: {
    padding: Spacing.md,
    paddingBottom: 80, // space for FAB
  },

  // Routine card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  typeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    gap: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardName: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  cardTime: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.primary,
    flexShrink: 0,
  },
  cardSub: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  cardRepeat: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  flagRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  flagAurelia: {
    backgroundColor: Colors.aureliaBg,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  flagText: {
    fontSize: 9,
    color: Colors.aureliaText,
    fontWeight: Typography.weight.semibold,
  },
  flagAlert: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  flagAlertText: {
    fontSize: 9,
    color: Colors.warningText,
    fontWeight: Typography.weight.semibold,
  },

  // Action buttons
  cardActions: {
    flexDirection: 'column',
    gap: Spacing.sm,
    flexShrink: 0,
    alignItems: 'center',
  },
  editBtn: {
    padding: 4,
  },
  deleteBtn: {
    padding: 4,
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.progressBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    marginTop: Spacing.sm,
  },
  emptyBtnText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.white,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
