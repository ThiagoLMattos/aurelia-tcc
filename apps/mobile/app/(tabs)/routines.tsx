/**
 * Aurélia — Rotinas tab
 * Lists all routine items. Each card shows type, name, time, repeat summary,
 * and reminder flags. FAB opens the routine builder modal.
 */

import React, { useCallback } from 'react';
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useApp } from '@/context/AppContext';
import { Task, TaskType } from '@/data/mock';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  TaskType,
  { label: string; icon: IconSymbolName; color: string; bg: string }
> = {
  medication: { label: 'Medicação', icon: 'pills.fill', color: Colors.primary, bg: Colors.primaryLight },
  meal:       { label: 'Refeição',  icon: 'fork.knife', color: '#7B5E3B', bg: '#FFF3E0' },
  activity:   { label: 'Atividade', icon: 'figure.walk', color: Colors.successText, bg: Colors.successBg },
  custom:     { label: 'Personalizada', icon: 'star.fill', color: Colors.aureliaText, bg: Colors.aureliaBg },
};

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function repeatSummary(days: number[]): string {
  if (days.length === 7) return 'Todos os dias';
  const sorted = [...days].sort((a, b) => a - b);
  if (JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])) return 'Dias úteis';
  if (days.length === 0) return 'Sem repetição';
  return sorted.map((d) => DAY_LABELS[d]).join(', ');
}

// ─── Routine card ─────────────────────────────────────────────────────────────

function RoutineCard({
  task,
  onEdit,
  onDelete,
}: {
  task: Task;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = TYPE_CONFIG[task.type];

  return (
    <View style={styles.card}>
      {/* Left icon */}
      <View style={[styles.typeIconWrap, { backgroundColor: cfg.bg }]}>
        <IconSymbol name={cfg.icon} size={20} color={cfg.color} />
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName} numberOfLines={1}>{task.name}</Text>
          <Text style={styles.cardTime}>{task.time}</Text>
        </View>

        {task.dosage ? (
          <Text style={styles.cardSub}>{task.dosage} · {task.form}</Text>
        ) : null}

        <Text style={styles.cardRepeat}>{repeatSummary(task.repeatDays)}</Text>

        {/* Reminder flags */}
        <View style={styles.flagRow}>
          {task.notifyAurelia && (
            <View style={styles.flagAurelia}>
              <Text style={styles.flagText}>Aurélia</Text>
            </View>
          )}
          {task.alertIfMissed && (
            <View style={styles.flagAlert}>
              <Text style={styles.flagAlertText}>Alerta se perdida</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          onPress={() => onEdit(task.id)}
          style={styles.editBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="pencil" size={15} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(task.id)}
          style={styles.deleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="trash" size={15} color={Colors.dangerText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <IconSymbol name="list.bullet" size={32} color={Colors.tabInactive} />
      </View>
      <Text style={styles.emptyTitle}>Nenhuma rotina criada</Text>
      <Text style={styles.emptySub}>
        Adicione medicações, refeições e atividades para que Aurélia possa acompanhar o dia de Maria.
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
  const { tasks, deleteTask } = useApp();
  const router = useRouter();

  const handleAdd = useCallback(() => {
    router.push('/routine-builder');
  }, [router]);

  const handleEdit = useCallback(
    (id: string) => {
      router.push({ pathname: '/routine-builder', params: { id } });
    },
    [router],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteTask(id);
    },
    [deleteTask],
  );

  const renderItem = useCallback(
    ({ item }: { item: Task }) => (
      <RoutineCard task={item} onEdit={handleEdit} onDelete={handleDelete} />
    ),
    [handleEdit, handleDelete],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Rotinas</Text>
          <Text style={styles.headerSub}>
            {tasks.length} {tasks.length === 1 ? 'item' : 'itens'} configurados
          </Text>
        </View>
        <TouchableOpacity style={styles.headerAddBtn} onPress={handleAdd} activeOpacity={0.85}>
          <IconSymbol name="plus" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* List */}
      {tasks.length === 0 ? (
        <EmptyState onAdd={handleAdd} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      )}

      {/* FAB */}
      {tasks.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={handleAdd} activeOpacity={0.85}>
          <IconSymbol name="plus" size={24} color={Colors.white} />
        </TouchableOpacity>
      )}
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
