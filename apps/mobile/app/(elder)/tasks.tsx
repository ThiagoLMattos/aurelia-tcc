import type { AgendaItem } from '@aurelia/shared';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, LoadingState } from '@/components';
import { BigButton, ElderHeader, MIN_TOUCH, Sheet, SheetText, type Section } from '@/elder/ui';
import { friendlyError } from '@/lib/errors';
import { useAgenda, useElderSelf, useMarkDone, useToday } from '@/queries';
import { PatientColors, PatientTypography, Shadow } from '@/theme';

const SECTION: Section = {
  main: PatientColors.tasksMain,
  headerButton: PatientColors.tasksHeaderButton,
  border: PatientColors.tasksBorder,
  text: PatientColors.tasksHeaderText,
};

const CELEBRATION_MS = 1400;

/** Big check that pops in when a task is confirmed; closes itself. */
function DoneCelebration({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const scale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.4);
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    const timer = setTimeout(onClose, CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [visible, scale, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.celebrateOverlay} onPress={onClose} accessibilityLabel="Tarefa feita. Toque para fechar.">
        <Animated.View style={[styles.celebrateBadge, { transform: [{ scale }] }]}>
          <Text style={styles.celebrateCheck}>✓</Text>
        </Animated.View>
        <Text style={styles.celebrateText}>MUITO BEM!</Text>
      </Pressable>
    </Modal>
  );
}

function TaskCard({ item, onConclude }: { item: AgendaItem; onConclude: (item: AgendaItem) => void }) {
  const done = item.status === 'done';
  const missed = item.status === 'missed';
  const current = item.status === 'now';
  const detail = item.medication ? `${item.medication.dosage}${item.description ? ` — ${item.description}` : ''}` : item.description;

  return (
    <View style={[styles.taskCard, done && styles.taskCardDone, current && styles.taskCardNow]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.taskName, done && styles.taskNameDone]}>{item.name}</Text>
        {done ? (
          <View style={[styles.concludeButton, styles.concludeButtonDone]} accessibilityLabel={`${item.name}: feito`}>
            <Text style={styles.concludeButtonText}>FEITO ✓</Text>
          </View>
        ) : missed ? (
          <View style={[styles.concludeButton, styles.concludeButtonMissed]} accessibilityLabel={`${item.name}: não foi feita`}>
            <Text style={[styles.concludeButtonText, styles.missedText]}>PERDIDA</Text>
          </View>
        ) : (
          <Pressable
            style={styles.concludeButton}
            onPress={() => onConclude(item)}
            accessibilityRole="button"
            accessibilityLabel={`Marcar ${item.name} como feita`}
          >
            <Text style={styles.concludeButtonText}>FEITO</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.taskDescription}>{detail ? `${item.time} — ${detail}` : item.time}</Text>
    </View>
  );
}

export default function TarefasIdosoScreen() {
  const router = useRouter();
  const elder = useElderSelf();
  const today = useToday(elder);
  const agenda = useAgenda(elder.id, today);
  const markDone = useMarkDone(elder.id, today, 'elder');

  const [selected, setSelected] = useState<AgendaItem | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const closeCelebration = useCallback(() => setCelebrating(false), []);

  function confirmDone() {
    if (!selected) return;
    const routineId = selected.routineId;
    setSelected(null);
    markDone.mutate(routineId, {
      onSuccess: () => {
        setCelebrating(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      },
      onError: (error) => Alert.alert('Não foi possível confirmar', friendlyError(error)),
    });
  }

  const items = agenda.data?.items ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <ElderHeader title="TAREFAS" section={SECTION} onBack={() => router.back()} />

      {agenda.isPending ? (
        <LoadingState role="elder" />
      ) : agenda.isError && !agenda.data ? (
        <ErrorState role="elder" message={friendlyError(agenda.error)} onRetry={() => void agenda.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.routineId}
          renderItem={({ item }) => <TaskCard item={item} onConclude={setSelected} />}
          refreshControl={<RefreshControl refreshing={agenda.isRefetching} onRefresh={() => void agenda.refetch()} />}
          ListEmptyComponent={<Text style={styles.empty}>Nenhuma tarefa para hoje.</Text>}
          contentContainerStyle={items.length === 0 ? styles.emptyWrap : undefined}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Sheet visible={selected !== null} onClose={() => setSelected(null)} accent={PatientColors.tasksMain}>
        <SheetText>Você já concluiu a tarefa?</SheetText>
        <SheetText strong>{selected?.name.toUpperCase()}</SheetText>
        <BigButton label="CONCLUÍ" onPress={confirmDone} color={PatientColors.tasksMain} textColor={PatientColors.tasksHeaderText} />
        <BigButton label="CANCELAR" onPress={() => setSelected(null)} color={PatientColors.tasksHeaderButton} textColor={PatientColors.tasksHeaderText} />
      </Sheet>

      <DoneCelebration visible={celebrating} onClose={closeCelebration} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  empty: { fontSize: PatientTypography.size.common, color: '#2C2C2C', textAlign: 'center', padding: 32 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },

  taskCard: { borderWidth: 0.5, borderColor: '#2C2C2C', paddingVertical: 20, paddingHorizontal: 16, gap: 12 },
  taskCardDone: { backgroundColor: '#F1EFE8', borderColor: PatientColors.tasksDoneIcon, opacity: 0.8 },
  taskCardNow: { borderWidth: 3, borderColor: PatientColors.tasksMain },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  taskName: { flex: 1, fontSize: PatientTypography.size.common, color: '#2C2C2C' },
  taskNameDone: { textDecorationLine: 'line-through', color: '#5F5E5A' },
  taskDescription: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
    color: '#2C2C2C',
    lineHeight: PatientTypography.size.reduced * PatientTypography.lineHeight.normal,
  },
  concludeButton: {
    backgroundColor: PatientColors.tasksHeaderButton,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PatientColors.tasksBorder,
    minWidth: 140,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.soft,
  },
  concludeButtonDone: { backgroundColor: PatientColors.tasksMain, borderColor: PatientColors.tasksDoneIcon },
  concludeButtonMissed: { backgroundColor: '#FAEEDA', borderColor: '#EF9F27' },
  concludeButtonText: { color: PatientColors.tasksHeaderText, fontSize: PatientTypography.size.reduced, fontWeight: PatientTypography.weight.bold },
  missedText: { color: '#854F0B' },

  celebrateOverlay: { flex: 1, backgroundColor: 'rgba(15, 80, 30, 0.85)', alignItems: 'center', justifyContent: 'center', gap: 24 },
  celebrateBadge: { width: 180, height: 180, borderRadius: 90, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  celebrateCheck: { fontSize: 110, color: PatientColors.tasksMain, fontWeight: '700' },
  celebrateText: { fontSize: PatientTypography.size.header, color: '#FFFFFF', fontWeight: '700' },
});
