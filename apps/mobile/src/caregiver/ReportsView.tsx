/**
 * The caregiver's "Relatórios" view on Início: the week's adherence, day by day, Aurélia's analysis,
 * the memory games, and a text export. Split out of the home screen, which only switches to it.
 */

import { addDays, LABELS_PT, weekStartOf, type GamesReport, type LocalDate, type WeeklyReport } from '@aurelia/shared';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, type RefreshControlProps, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ErrorState, LoadingState } from '@/components';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { friendlyError } from '@/lib/errors';
import { weekRange } from '@/lib/format';
import { useWeeklyReport } from '@/queries';
import { Colors, Radius, Spacing, Typography } from '@/theme';

/** The sentence under "Análise semanal", built from the report's numbers. */
function generateInsight(name: string, current: WeeklyReport, previous: WeeklyReport | undefined): string {
  const { sessions } = current.games;
  const games = sessions > 0 ? ` ${name} jogou ${sessions} partida${sessions > 1 ? 's' : ''} nos jogos do celular.` : '';
  const med = current.adherence.medication.pct;
  if (med === null) {
    let text = `Nenhum medicamento estava previsto esta semana para ${name}.`;
    if (current.geofenceExits > 0) text += ` Houve ${current.geofenceExits} saída${current.geofenceExits > 1 ? 's' : ''} da zona segura.`;
    return text + games;
  }

  let text =
    med >= 90
      ? `Boa semana para a medicação — ${med}% de aderência`
      : med >= 75
      ? `Semana razoável — ${med}% de aderência a medicamentos`
      : `Semana preocupante — apenas ${med}% de aderência a medicamentos`;

  const before = previous?.adherence.medication.pct;
  if (before !== null && before !== undefined && before !== med) {
    const delta = med - before;
    text += delta > 0
      ? `, melhora de ${delta} p.p. em relação à semana anterior`
      : `, queda de ${Math.abs(delta)} p.p. em relação à semana anterior`;
  }
  text += '.';

  if (current.missedCount > 0) {
    text += ` ${current.missedCount} tarefa${current.missedCount > 1 ? 's' : ''} não ${current.missedCount > 1 ? 'foram confirmadas' : 'foi confirmada'} — vale conversar com ${name} sobre os horários.`;
  }
  if (current.geofenceExits > 0) {
    text += ` Houve ${current.geofenceExits} evento${current.geofenceExits > 1 ? 's' : ''} de saída da zona segura.`;
  }
  if (current.sosCount > 0) {
    text += ` O botão SOS foi acionado ${current.sosCount} vez${current.sosCount > 1 ? 'es' : ''}.`;
  }
  return text + games;
}

const pctLabel = (pct: number | null) => (pct === null ? '—' : `${pct}%`);

/** Delta badge: +10 pp ↑ in green / −5 pp ↓ in red / nothing when either week has no data */
function DeltaBadge({ current, previous }: { current: number | null; previous: number | null | undefined }) {
  if (current === null || previous === null || previous === undefined) return null;
  const diff = current - previous;
  if (diff === 0) return <Text style={styles.rDeltaFlat}>= estável</Text>;
  const up = diff > 0;
  return (
    <Text style={[styles.rDelta, up ? styles.rDeltaUp : styles.rDeltaDown]}>
      {up ? '▲' : '▼'} {up ? '+' : ''}{diff} p.p.
    </Text>
  );
}

const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function RelatoriosView({ elderId, elderName, today, refreshControl }: { elderId: string; elderName: string; today: LocalDate; refreshControl: React.ReactElement<RefreshControlProps> }) {
  const router = useRouter();
  const thisWeek = weekStartOf(today);
  const [weekStart, setWeekStart] = useState<LocalDate>(thisWeek);
  const report = useWeeklyReport(elderId, weekStart);
  const previous = useWeeklyReport(elderId, addDays(weekStart, -7));
  const isCurrent = weekStart >= thisWeek;

  const insight = useMemo(
    () => (report.data ? generateInsight(elderName, report.data, previous.data) : ''),
    [report.data, previous.data, elderName],
  );

  const handleExport = useCallback(async () => {
    if (!report.data) return;
    const label = weekRange(report.data.weekStart, report.data.weekEnd);
    const msg =
      `Relatório Aurélia — ${label}\n` +
      `Aderência a medicamentos: ${pctLabel(report.data.adherence.medication.pct)}\n` +
      `Aderência geral: ${pctLabel(report.data.adherence.all.pct)}\n` +
      `Saídas da zona segura: ${report.data.geofenceExits}\n` +
      `SOS acionados: ${report.data.sosCount}\n` +
      `Jogos: ${report.data.games.sessions} partida${report.data.games.sessions === 1 ? '' : 's'} (${report.data.games.minutes} min)\n\n` +
      `${insight}`;
    try {
      await Share.share({ message: msg, title: `Relatório Aurélia ${label}` });
    } catch {
      Alert.alert('Exportar', 'Não foi possível compartilhar o relatório.');
    }
  }, [report.data, insight]);

  if (report.isPending) return <LoadingState />;
  if (report.isError) return <ErrorState message={friendlyError(report.error)} onRetry={() => void report.refetch()} />;

  const data = report.data;
  const prev = previous.data;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.rScrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >

      {/* ── Week selector ── */}
      <View style={styles.rWeekRow}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setWeekStart((w) => addDays(w, -7))}
          style={styles.rWeekArrow}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Semana anterior"
        >
          <IconSymbol name="chevron.left" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.rWeekLabel}>{weekRange(data.weekStart, data.weekEnd)}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setWeekStart((w) => addDays(w, 7))}
          disabled={isCurrent}
          style={[styles.rWeekArrow, isCurrent && styles.rWeekArrowDisabled]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Próxima semana"
        >
          <IconSymbol name="chevron.right" size={18} color={isCurrent ? Colors.tabInactive : Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Aurélia insight card ── */}
      <View style={styles.rAureliaCard}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(caregiver)/(tabs)/assistant')}>
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
          <Text style={styles.rStatValue}>{pctLabel(data.adherence.medication.pct)}</Text>
          <Text style={styles.rStatLabel}>Medicamentos</Text>
          <DeltaBadge current={data.adherence.medication.pct} previous={prev?.adherence.medication.pct} />
        </View>
        {/* Task adherence */}
        <View style={[styles.rStatBox, styles.rStatBoxMid]}>
          <Text style={styles.rStatValue}>{pctLabel(data.adherence.all.pct)}</Text>
          <Text style={styles.rStatLabel}>Tarefas gerais</Text>
          <DeltaBadge current={data.adherence.all.pct} previous={prev?.adherence.all.pct} />
        </View>
        {/* Geo-fence events */}
        <View style={styles.rStatBox}>
          <Text style={[styles.rStatValue, data.geofenceExits > 0 && styles.rStatValueDanger]}>
            {data.geofenceExits}
          </Text>
          <Text style={styles.rStatLabel}>Saídas zona</Text>
          {prev ? (
            <Text style={styles.rDeltaFlat}>
              {data.geofenceExits === prev.geofenceExits
                ? '= estável'
                : data.geofenceExits < prev.geofenceExits
                ? '▲ melhora'
                : '▼ piora'}
            </Text>
          ) : null}
        </View>
      </View>

      {data.minutesOutside > 0 || data.sosCount > 0 ? (
        <View style={styles.rCard}>
          <Text style={styles.rCardTitle}>Alertas da semana</Text>
          {data.minutesOutside > 0 ? <Text style={styles.reportLine}>{data.minutesOutside} min fora da zona segura</Text> : null}
          {data.sosCount > 0 ? <Text style={styles.reportLine}>{data.sosCount} acionamento{data.sosCount > 1 ? 's' : ''} do SOS</Text> : null}
        </View>
      ) : null}

      <GamesCard report={data.games} previous={prev?.games} elderName={elderName} weekInProgress={isCurrent} />

      {/* ── Day-by-day chart ── */}
      <View style={styles.rCard}>
        <Text style={styles.rCardTitle}>Dia a dia</Text>
        {data.days.map((day, index) => {
          const total = day.done + day.missed;
          const pct = total > 0 ? day.done / total : 0;
          return (
            <View key={day.date} style={styles.rDayRow}>
              <View style={styles.rDayLabelCol}>
                <Text style={styles.rDayName}>{WEEKDAY_SHORT[index]}</Text>
                <Text style={styles.rDayNum}>{Number(day.date.slice(8, 10))}</Text>
              </View>
              <View style={styles.rBarCol}>
                <View style={styles.rBarBg}>
                  <View style={[styles.rBarFill, { width: `${pct * 100}%` as `${number}%` }]} />
                </View>
                <View style={styles.rDayBadges}>
                  {day.missed > 0 && (
                    <View style={styles.rBadgeMissed}>
                      <Text style={styles.rBadgeText}>{day.missed} perdida{day.missed > 1 ? 's' : ''}</Text>
                    </View>
                  )}
                  {day.geofenceExits > 0 && (
                    <View style={styles.rBadgeBreach}>
                      <Text style={styles.rBadgeText}>saída</Text>
                    </View>
                  )}
                  {day.sos > 0 && (
                    <View style={styles.rBadgeBreach}>
                      <Text style={styles.rBadgeText}>SOS</Text>
                    </View>
                  )}
                  {day.games > 0 && (
                    <View style={styles.badgeGame}>
                      <Text style={styles.rBadgeText}>{day.games} jogo{day.games > 1 ? 's' : ''}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.rDayCount}>{day.done}/{total}</Text>
            </View>
          );
        })}
      </View>

      {/* ── Export / Share ── */}
      <TouchableOpacity style={styles.rExportBtn} onPress={() => void handleExport()} activeOpacity={0.85} accessibilityRole="button">
        <IconSymbol name="square.and.arrow.up" size={18} color={Colors.white} />
        <Text style={styles.rExportText}>Exportar relatório</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "▲ +2" / "▼ −1" / "= igual" against last week; nothing when last week has no number to compare. */
function GameDelta({ current, previous, suffix = '' }: { current: number | null; previous: number | null | undefined; suffix?: string }) {
  if (current === null || previous === null || previous === undefined) return null;
  const diff = current - previous;
  if (diff === 0) return <Text style={games.deltaFlat}>= igual à semana anterior</Text>;
  const up = diff > 0;
  return (
    <Text style={[games.delta, up ? styles.rDeltaUp : styles.rDeltaDown]}>
      {`${up ? '▲ +' : '▼ −'}${Math.abs(diff)}${suffix} vs. semana anterior`}
    </Text>
  );
}

/** One game's best result of the week, or a quiet placeholder when it was not played. */
function GameTile({
  icon,
  name,
  value,
  caption,
  footer,
  delta,
}: {
  icon: 'square.grid.2x2.fill' | 'circle.grid.2x2.fill' | 'number' | 'textformat.abc';
  name: string;
  value: string | null;
  caption: string;
  footer: string;
  delta: React.ReactNode;
}) {
  const played = value !== null;
  return (
    <View style={[games.tile, !played && games.tileIdle]} accessible accessibilityLabel={played ? `${name}: ${value}, ${caption}. ${footer}.` : `${name}: não jogado nesta semana.`}>
      <View style={games.tileHead}>
        <IconSymbol name={icon} size={14} color={played ? Colors.primary : Colors.textMuted} />
        <Text style={[games.tileName, !played && games.muted]} numberOfLines={1}>{name}</Text>
      </View>
      {played ? (
        <>
          <Text style={games.tileValue}>{value}</Text>
          <Text style={games.tileCaption}>{caption}</Text>
          {delta}
          <View style={games.tileFooter}>
            <Text style={games.tileFooterText}>{footer}</Text>
          </View>
        </>
      ) : (
        <Text style={[games.tileCaption, games.idleText]}>Não jogado nesta semana</Text>
      )}
    </View>
  );
}

/**
 * The week's memory games: how often and how long, then the best result of each game. The count is
 * compared with last week only once the week is over; mid-week it would always look like a drop.
 */
function GamesCard({
  report,
  previous,
  elderName,
  weekInProgress,
}: {
  report: GamesReport;
  previous: GamesReport | undefined;
  elderName: string;
  weekInProgress: boolean;
}) {
  const { memory, sequence, ticTacToe, crossword } = report;
  const sessionsBefore = weekInProgress ? undefined : previous?.sessions;

  return (
    <View style={styles.rCard}>
      <View style={games.header}>
        <View style={games.badge}>
          <IconSymbol name="puzzlepiece.fill" size={18} color={Colors.primary} />
        </View>
        <View style={games.headerText}>
          <Text style={games.title}>Jogos da semana</Text>
          <Text style={games.subtitle}>
            {report.sessions === 0 ? 'Nenhuma partida' : `${plural(report.sessions, 'partida', 'partidas')} · ${report.minutes} min jogando`}
          </Text>
        </View>
        {sessionsBefore !== undefined && report.sessions !== sessionsBefore ? (
          <View style={[games.pill, report.sessions > sessionsBefore ? games.pillUp : games.pillDown]}>
            <Text style={[games.pillText, report.sessions > sessionsBefore ? styles.rDeltaUp : styles.rDeltaDown]}>
              {`${report.sessions > sessionsBefore ? '▲ +' : '▼ −'}${plural(Math.abs(report.sessions - sessionsBefore), 'partida', 'partidas')}`}
            </Text>
          </View>
        ) : null}
      </View>

      {report.sessions === 0 ? (
        <View style={games.empty}>
          <Text style={games.emptyText}>{`Quando ${elderName} jogar no celular, os resultados aparecem aqui.`}</Text>
        </View>
      ) : (
        <View style={games.tiles}>
          <GameTile
            icon="square.grid.2x2.fill"
            name={LABELS_PT.game.memory}
            value={memory.played > 0 ? `${memory.bestAccuracyPct}%` : null}
            caption="melhor taxa de acertos"
            footer={`${plural(memory.played, 'partida', 'partidas')} · até ${plural(memory.mostPairs ?? 0, 'par', 'pares')}`}
            delta={<GameDelta current={memory.bestAccuracyPct} previous={previous?.memory.bestAccuracyPct} suffix=" p.p." />}
          />
          <GameTile
            icon="circle.grid.2x2.fill"
            name={LABELS_PT.game.sequence}
            value={sequence.played > 0 ? plural(sequence.best ?? 0, 'cor', 'cores') : null}
            caption="maior sequência lembrada"
            footer={plural(sequence.played, 'partida', 'partidas')}
            delta={<GameDelta current={sequence.best} previous={previous?.sequence.best} />}
          />
          <GameTile
            icon="number"
            name={LABELS_PT.game.tictactoe}
            value={ticTacToe.played > 0 ? plural(ticTacToe.wins, 'vitória', 'vitórias') : null}
            caption={`em ${plural(ticTacToe.played, 'partida', 'partidas')} contra o celular`}
            footer={`${plural(ticTacToe.draws, 'empate', 'empates')} · ${plural(ticTacToe.played - ticTacToe.wins - ticTacToe.draws, 'derrota', 'derrotas')}`}
            delta={null}
          />
          <GameTile
            icon="textformat.abc"
            name={LABELS_PT.game.crossword}
            value={crossword.played > 0 ? plural(crossword.words, 'palavra', 'palavras') : null}
            caption={`encontradas em ${plural(crossword.played, 'cruzadinha', 'cruzadinhas')}`}
            footer={`${plural(crossword.completed, 'completa', 'completas')} · ${plural(crossword.hints, 'dica', 'dicas')}`}
            delta={null}
          />
        </View>
      )}
    </View>
  );
}

const games = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 1 },
  title: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: Colors.textPrimary },
  subtitle: { fontSize: 12, color: Colors.textSecondary },
  pill: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  pillUp: { backgroundColor: Colors.successBg },
  pillDown: { backgroundColor: Colors.dangerBg },
  pillText: { fontSize: 11, fontWeight: Typography.weight.semibold },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  /** Two tiles per row. */
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 2,
  },
  tileIdle: { backgroundColor: Colors.white, borderStyle: 'dashed' },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: Spacing.xs },
  tileName: { flex: 1, fontSize: 11, fontWeight: Typography.weight.semibold, color: Colors.textSecondary },
  muted: { color: Colors.textMuted },
  tileValue: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: Colors.primary },
  tileCaption: { fontSize: 11, color: Colors.textSecondary },
  idleText: { color: Colors.textMuted, marginTop: Spacing.xs },
  delta: { fontSize: 10, fontWeight: Typography.weight.semibold, marginTop: 2 },
  deltaFlat: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  tileFooter: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 0.5, borderTopColor: Colors.border },
  tileFooterText: { fontSize: 11, color: Colors.textPrimary },
  empty: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md },
  emptyText: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
});

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.surface,
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
  rScrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
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
  reportLine: { fontSize: Typography.size.sm, color: Colors.textPrimary },
  badgeGame: { backgroundColor: Colors.primaryLight, borderRadius: Radius.full, paddingHorizontal: 5, paddingVertical: 1 },
});
