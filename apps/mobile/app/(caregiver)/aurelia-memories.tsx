import { LABELS_PT, weekdayOf, type AssistantMemory } from '@aurelia/shared';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, EmptyState, ErrorState, LoadingState, ScreenHeader } from '@/components';
import { confirm } from '@/lib/confirm';
import { friendlyError } from '@/lib/errors';
import { firstName } from '@/lib/format';
import { useCurrentElder, useForgetMemory, useMemories } from '@/queries';
import { Colors, Radius, Spacing, Typography } from '@/theme';

const dayLabel = (memory: AssistantMemory) =>
  `${LABELS_PT.weekdayLong[weekdayOf(memory.date)]}, ${memory.date.slice(8, 10)}/${memory.date.slice(5, 7)}/${memory.date.slice(0, 4)}`;

/**
 * What Aurélia remembers from the elder's conversations: one short summary per conversation, never the
 * conversation itself. The family can read them and make Aurélia forget any of them.
 */
export default function AureliaMemoriesScreen() {
  const elder = useCurrentElder();
  const memories = useMemories(elder.id);
  const forget = useForgetMemory(elder.id);
  const name = firstName(elder.name);
  const items = memories.data?.items ?? [];

  async function handleForget(memory: AssistantMemory) {
    const ok = await confirm('Esquecer lembrança', 'A Aurélia não vai mais usar este resumo nas conversas.', 'Esquecer', true);
    if (!ok) return;
    forget.mutate(memory.id, { onError: (error) => Alert.alert('Não foi possível esquecer', friendlyError(error)) });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={memories.isRefetching} onRefresh={() => void memories.refetch()} />}
      >
        <ScreenHeader title="O que a Aurélia lembra" />
        <Text style={styles.lead}>
          Depois de cada conversa com {name}, a Aurélia guarda um resumo curto do que foi contado: pessoas, lembranças,
          gostos e como {name} estava. Ela usa estes resumos para lembrar junto nas próximas conversas. A conversa
          inteira nunca é guardada.
        </Text>

        {memories.isPending ? (
          <LoadingState />
        ) : memories.isError ? (
          <ErrorState message={friendlyError(memories.error)} onRetry={() => void memories.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhuma lembrança ainda"
            message={` Quando ${name} conversar com a Aurélia, o resumo aparece aqui uns 10 minutos depois.`}
          />
        ) : (
          items.map((memory) => (
            <Card key={memory.id} style={styles.card}>
              <Text style={styles.date}>{dayLabel(memory)}</Text>
              <Text style={styles.summary}>{memory.summary}</Text>
              <TouchableOpacity
                onPress={() => void handleForget(memory)}
                disabled={forget.isPending}
                style={styles.forget}
                accessibilityRole="button"
                accessibilityLabel={`Esquecer a lembrança de ${dayLabel(memory)}`}
              >
                <Text style={styles.forgetText}>Esquecer</Text>
              </TouchableOpacity>
            </Card>
          ))
        )}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.lg, gap: Spacing.md },
  lead: { fontSize: Typography.size.base, color: Colors.textSecondary, lineHeight: 22 },
  card: { gap: Spacing.sm },
  date: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: Colors.primary },
  summary: { fontSize: Typography.size.base, color: Colors.textPrimary, lineHeight: 22 },
  forget: { alignSelf: 'flex-end', paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: Radius.md },
  forgetText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: Colors.dangerText },
});
