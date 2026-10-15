/**
 * Aurélia — Home screen (Início)
 * Primary daily-use screen for the caregiver.
 * Answers "está tudo bem agora?" in under 3 seconds.
 *
 * Three states, derived from the server (today's agenda and the elder's location):
 *   1. Normal       — tudo certo, dentro da zona segura
 *   2. Alerta       — tarefa perdida (amber)
 *   3. Saída zona   — saída da zona segura não resolvida (red)
 */

import {
  haversineMeters,
  localTimeOf,
  minutesOfDay,
  weekStartOf,
  type AgendaItem,
  type AgendaStatus,
  type LocationResponse,
  type RoutineType,
} from '@aurelia/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { RelatoriosView } from '@/caregiver/ReportsView';
import { ErrorState, FocusStatusBar, LoadingState } from '@/components';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { friendlyError } from '@/lib/errors';
import { clockTime, countdownLabel, firstName } from '@/lib/format';
import { mockControls } from '@/lib/backend';
import {
  useAgenda,
  useCurrentElder,
  useLatestExit,
  useLocation,
  useMarkDone,
  useNow,
  useOpenSos,
  useToday,
  useUndoDone,
  useWeeklyReport,
} from '@/queries';
import { Colors, Radius, Spacing, Typography } from '@/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScreenState = 'normal' | 'missed' | 'breach';
type ActiveTab = 'hoje' | 'relatorios';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minutes from now until a scheduled 'HH:mm' (in the elder's timezone). Negative = overdue. */
function minutesUntil(time: string, now: Date, timezone: string): number {
  return minutesOfDay(time) - minutesOfDay(localTimeOf(now, timezone));
}

function taskTypeIcon(type: RoutineType): 'pills.fill' | 'fork.knife' | 'figure.walk' | 'star.fill' {
  switch (type) {
    case 'medication': return 'pills.fill';
    case 'meal': return 'fork.knife';
    case 'activity': return 'figure.walk';
    default: return 'star.fill';
  }
}

const OPEN_STATUSES: AgendaStatus[] = ['now', 'pending', 'upcoming'];

/** What the "Agora" card is about: what is due, else what is overdue, else what comes next. */
function currentItem(items: AgendaItem[]): AgendaItem | null {
  return (
    items.find((i) => i.status === 'now') ??
    items.find((i) => i.status === 'pending') ??
    items.find((i) => i.status === 'upcoming') ??
    null
  );
}

function countItems(items: AgendaItem[]) {
  return {
    done: items.filter((i) => i.status === 'done').length,
    missed: items.filter((i) => i.status === 'missed').length,
    open: items.filter((i) => OPEN_STATUSES.includes(i.status)).length,
    total: items.length,
  };
}

/** How far outside the safe radius the last known position is, in metres (0 when inside or unknown). */
function metersOutside(location: LocationResponse | undefined): number | null {
  if (!location?.safeZone || location.lat === null || location.lng === null) return null;
  const distance = haversineMeters({ lat: location.lat, lng: location.lng }, location.safeZone);
  return Math.max(0, Math.round(distance - location.safeZone.radiusM));
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
          accessibilityRole="tab"
          accessibilityState={{ selected: active === t.key }}
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
  elderName,
  missedTaskName,
  missedTaskTime,
  onBreachPress,
}: {
  screenState: ScreenState;
  elderName: string;
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
    <TouchableOpacity onPress={onBreachPress} activeOpacity={0.85} accessibilityRole="button">
      <View style={styles.alertBannerRed}>
        <View style={styles.alertBannerRow}>
          <IconSymbol name="location.slash.fill" size={14} color={Colors.dangerText} />
          <Text style={styles.alertBannerText}>
            <Text style={styles.alertBannerBold}>{elderName} saiu da zona segura.</Text>
            {' '}Toque para ver detalhes.
          </Text>
          <IconSymbol name="chevron.right" size={14} color={Colors.dangerText} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** An SOS nobody answered yet: the way back to it when the push was missed. */
function SosBanner({ elderName, at, onPress }: { elderName: string; at: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      <View style={styles.alertBannerRed}>
        <View style={styles.alertBannerRow}>
          <IconSymbol name="bell.fill" size={14} color={Colors.dangerText} />
          <Text style={styles.alertBannerText}>
            <Text style={styles.alertBannerBold}>SOS de {elderName} às {at}.</Text>
            {' '}Ninguém respondeu ainda. Toque para ver.
          </Text>
          <IconSymbol name="chevron.right" size={14} color={Colors.dangerText} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** The chip on the "Agora" card that says where the elder is; once a zone exists it opens the map. */
function LocationChip({
  location,
  exitResolved,
  onSetup,
  onOpen,
}: {
  location: LocationResponse | undefined;
  exitResolved: boolean;
  onSetup: () => void;
  onOpen: () => void;
}) {
  if (!location) return null;
  if (!location.safeZone) {
    return (
      <TouchableOpacity style={[styles.chipGeoOk, extra.chipNeutral]} onPress={onSetup} accessibilityRole="button">
        <Text style={[styles.chipGeoOkText, extra.chipNeutralText]}>Definir zona segura</Text>
      </TouchableOpacity>
    );
  }
  const open = { onPress: onOpen, accessibilityRole: 'button' as const, accessibilityHint: 'Abre o mapa' };
  if (location.status === 'inside') {
    return (
      <TouchableOpacity style={styles.chipGeoOk} {...open}>
        <IconSymbol name="location.fill" size={10} color={Colors.successText} />
        <Text style={styles.chipGeoOkText}>Dentro da zona segura</Text>
        <IconSymbol name="chevron.right" size={10} color={Colors.successText} />
      </TouchableOpacity>
    );
  }
  if (location.status === 'outside') {
    return (
      <TouchableOpacity style={[styles.chipGeoOk, extra.chipWarn]} {...open}>
        <IconSymbol name="location.slash.fill" size={10} color={Colors.warningText} />
        <Text style={[styles.chipGeoOkText, extra.chipWarnText]}>{exitResolved ? 'Fora · confirmado seguro' : 'Fora da zona segura'}</Text>
        <IconSymbol name="chevron.right" size={10} color={Colors.warningText} />
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={[styles.chipGeoOk, extra.chipNeutral]} {...open}>
      <Text style={[styles.chipGeoOkText, extra.chipNeutralText]}>Sem sinal do rastreador</Text>
      <IconSymbol name="chevron.right" size={10} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
}

// "Agora" card
function RightNowCard({
  item,
  items,
  screenState,
  location,
  exitResolved,
  timezone,
  marking,
  onMarkDone,
  onBreachPress,
  onSetupZone,
  onOpenLocation,
}: {
  item: AgendaItem | null;
  items: AgendaItem[];
  screenState: ScreenState;
  location: LocationResponse | undefined;
  exitResolved: boolean;
  timezone: string;
  marking: boolean;
  onMarkDone: (routineId: string) => void;
  onBreachPress: () => void;
  onSetupZone: () => void;
  onOpenLocation: () => void;
}) {
  const now = useNow(30_000);
  const counts = countItems(items);
  const progress = counts.total > 0 ? counts.done / counts.total : 0;

  // Breach state — repurpose card to show breach info
  if (screenState === 'breach') {
    const outside = metersOutside(location);
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
          {outside !== null ? `Última localização: ~${outside} m fora do raio seguro.` : 'Sem localização recente do rastreador.'}
        </Text>
        <TouchableOpacity onPress={onBreachPress} style={styles.btnBreachDetail} accessibilityRole="button">
          <IconSymbol name="map.fill" size={14} color={Colors.white} />
          <Text style={styles.btnBreachDetailText}>Ver alerta completo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Nothing left to do today
  if (!item) {
    return (
      <View style={styles.card}>
        <Text style={styles.taskTitle}>{counts.total === 0 ? 'Nenhuma tarefa para hoje' : 'Todas as tarefas resolvidas'}</Text>
        <Text style={styles.taskDesc}>
          {counts.total === 0 ? 'Crie rotinas na aba Rotinas para acompanhar o dia.' : `${counts.done} de ${counts.total} confirmadas hoje.`}
        </Text>
        {counts.total > 0 ? (
          <View style={styles.progressRow}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{counts.done} de {counts.total} feitas</Text>
          </View>
        ) : null}
        <View style={styles.geoRow}>
          <Text style={styles.geoLabel}>Localização</Text>
          <LocationChip location={location} exitResolved={exitResolved} onSetup={onSetupZone} onOpen={onOpenLocation} />
        </View>
      </View>
    );
  }

  const countdown = minutesUntil(item.time, now, timezone);
  const overdue = countdown < 0;
  const chipStyle = overdue ? styles.chipOverdue : styles.chipPending;
  const chipTextStyle = overdue ? styles.chipOverdueText : styles.chipPendingText;

  return (
    <View style={styles.card}>
      <View style={styles.taskCardHeader}>
        <View style={styles.taskTitleRow}>
          <IconSymbol name={taskTypeIcon(item.type)} size={14} color={Colors.primary} />
          <Text style={styles.taskTitle}>{item.name}</Text>
        </View>
        <View style={[styles.chip, chipStyle]}>
          <Text style={[styles.chipText, chipTextStyle]}>{countdownLabel(countdown)}</Text>
        </View>
      </View>

      <Text style={styles.taskDesc}>
        {item.medication ? `${item.medication.dosage} · ${item.medication.form}` : item.description || `Às ${item.time}`}
      </Text>

      <View style={styles.progressRow}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{counts.done} de {counts.total} feitas</Text>
      </View>

      <View style={styles.geoRow}>
        <Text style={styles.geoLabel}>Localização</Text>
        <LocationChip location={location} exitResolved={exitResolved} onSetup={onSetupZone} onOpen={onOpenLocation} />
      </View>

      {item.status !== 'upcoming' && (
        <TouchableOpacity
          style={[styles.btnMarkDone, marking && { opacity: 0.6 }]}
          onPress={() => onMarkDone(item.routineId)}
          disabled={marking}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <IconSymbol name="checkmark" size={14} color={Colors.white} />
          <Text style={styles.btnMarkDoneText}>Confirmar manualmente</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Timeline scroll — simple display, no interactive undo here
function TimelineScroll({ items }: { items: AgendaItem[] }) {
  const dotConfig: Record<AgendaStatus, { bg: string; color: string; icon: string }> = {
    done:     { bg: Colors.successBg,  color: Colors.successText,   icon: '✓' },
    upcoming: { bg: Colors.progressBg, color: Colors.textSecondary, icon: '–' },
    pending:  { bg: Colors.warningBg,  color: Colors.warningText,   icon: '!' },
    missed:   { bg: Colors.warningBg,  color: Colors.warningText,   icon: '✕' },
    now:      { bg: Colors.primary,    color: Colors.primaryLight,  icon: '●' },
  };

  if (items.length === 0) return null;

  return (
    <View>
      <Text style={styles.sectionLabel}>Linha do tempo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.timelineRow}>
          {items.map((item) => {
            const cfg = dotConfig[item.status];
            return (
              <View key={item.routineId} style={styles.timelineItem}>
                <Text style={styles.tlTime}>{item.time}</Text>
                <View style={[styles.tlDot, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.tlDotText, { color: cfg.color }]}>{cfg.icon}</Text>
                </View>
                <Text style={styles.tlLabel} numberOfLines={2}>{item.name.split(' ').slice(0, 2).join(' ')}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// Aurélia insight card — tappable, navigates to Aurélia chat tab
function AureliaCard({
  screenState,
  elderName,
  firstMissed,
  weekMissed,
  counts,
}: {
  screenState: ScreenState;
  elderName: string;
  firstMissed: AgendaItem | undefined;
  weekMissed: number;
  counts: ReturnType<typeof countItems>;
}) {
  const router = useRouter();
  const insightText =
    screenState === 'breach'
      ? `${elderName} saiu da zona segura. Recomendo ligar agora.`
      : screenState === 'missed' && firstMissed
      ? `${firstMissed.name} das ${firstMissed.time} não foi confirmada.${weekMissed > 1 ? ` É a ${weekMissed}ª perdida esta semana — vale verificar.` : ' Pode ter sido esquecida.'}`
      : counts.total === 0
      ? `Ainda não há rotinas para hoje. Cadastre as de ${elderName} na aba Rotinas.`
      : `Tudo tranquilo. ${counts.done} de ${counts.total} tarefas de hoje já foram confirmadas.`;

  const flagText =
    screenState === 'breach'
      ? 'Ação urgente necessária'
      : screenState === 'missed' && weekMissed > 1
      ? `${weekMissed}ª ocorrência esta semana`
      : null;

  return (
    <TouchableOpacity
      style={styles.aureliaCard}
      onPress={() => router.push('/(caregiver)/(tabs)/assistant')}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Conversar com a Aurélia"
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

// Dev state switcher — dev builds in mock mode only: with no tracker and no scheduler behind the
// mock, this is how a demo reaches the "missed" and "outside" states, an SOS, and its escalation.
function DevStateSwitcher({ onRefresh }: { onRefresh: () => void }) {
  if (!__DEV__ || !mockControls) return null;
  const controls = mockControls;

  const run = (action: () => void) => () => {
    try {
      action();
      onRefresh();
    } catch (error) {
      Alert.alert('Demo', friendlyError(error));
    }
  };

  const buttons: { label: string; onPress: () => void }[] = [
    { label: 'Perdida', onPress: run(() => controls.simulateMissed()) },
    { label: 'Saída', onPress: run(() => controls.simulateExit()) },
    { label: 'Retorno', onPress: run(() => controls.simulateReturn()) },
    { label: 'SOS', onPress: run(() => controls.simulateSos()) },
    { label: '+5 min', onPress: run(() => controls.skipToEscalation()) },
  ];

  return (
    <View style={styles.devSwitcher}>
      <Text style={styles.devSwitcherLabel}>Demo:</Text>
      {buttons.map((b) => (
        <TouchableOpacity accessibilityRole="button" key={b.label} onPress={b.onPress} style={styles.devBtn}>
          <Text style={styles.devBtnText}>{b.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const elder = useCurrentElder();
  const name = firstName(elder.name);
  const today = useToday(elder);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('hoje');

  const agenda = useAgenda(elder.id, today);
  const location = useLocation(elder.id);
  const outside = location.data?.status === 'outside';
  const latestExit = useLatestExit(elder.id, outside);
  const week = useWeeklyReport(elder.id, weekStartOf(today));
  const openSos = useOpenSos(elder.id);
  const markDone = useMarkDone(elder.id, today);
  const undoDone = useUndoDone(elder.id, today);

  const items = useMemo(() => agenda.data?.items ?? [], [agenda.data]);
  const counts = countItems(items);
  const missedItems = items.filter((i) => i.status === 'missed');
  const exitResolved = outside && latestExit.data?.payload.resolvedAt != null;

  const screenState: ScreenState =
    outside && !exitResolved ? 'breach' : missedItems.length > 0 ? 'missed' : 'normal';

  // ── Undo snackbar state ──────────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState<{ id: string; name: string } | null>(null);
  const snackbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
  }, []);

  const showSnackbar = useCallback((id: string, taskName: string) => {
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    setSnackbar({ id, name: taskName });
    snackbarTimer.current = setTimeout(() => setSnackbar(null), 5000);
  }, []);

  const handleUndoSnackbar = useCallback(() => {
    if (!snackbar) return;
    undoDone.mutate(snackbar.id, { onError: (error) => Alert.alert('Não foi possível desfazer', friendlyError(error)) });
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    setSnackbar(null);
  }, [snackbar, undoDone]);

  const handleBreachPress = useCallback(() => {
    router.push('/(caregiver)/geo-fence-breach');
  }, [router]);

  const handleSetupZone = useCallback(() => {
    router.push('/(caregiver)/safe-zone');
  }, [router]);

  const handleOpenLocation = useCallback(() => {
    router.push('/(caregiver)/location');
  }, [router]);

  const handleMarkDone = useCallback(
    (routineId: string) => {
      const task = items.find((i) => i.routineId === routineId);
      markDone.mutate(routineId, {
        onSuccess: () => {
          if (task) showSnackbar(routineId, task.name);
        },
        onError: (error) => Alert.alert('Não foi possível confirmar', friendlyError(error)),
      });
    },
    [items, markDone, showSnackbar],
  );

  const refreshing = agenda.isRefetching || location.isRefetching;
  const refetchAll = useCallback(() => {
    void agenda.refetch();
    void location.refetch();
    void week.refetch();
  }, [agenda, location, week]);
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={refetchAll} />;

  const firstMissed = missedItems[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FocusStatusBar style="light" />

      {/* Teal header section */}
      <View style={styles.headerSection}>
        <HeaderBar
          elderName={elder.name}
          screenState={screenState}
          missedCount={missedItems.length}
        />
        <TabPills active={activeTab} onChange={setActiveTab} />
      </View>

      {/* ── Relatórios view ── */}
      {activeTab === 'relatorios' && (
        <RelatoriosView elderId={elder.id} elderName={name} today={today} refreshControl={refreshControl} />
      )}

      {/* ── Hoje view ── */}
      {activeTab === 'hoje' && (agenda.isPending ? (
        <View style={styles.scroll}><LoadingState /></View>
      ) : agenda.isError ? (
        <View style={styles.scroll}><ErrorState message={friendlyError(agenda.error)} onRetry={() => void agenda.refetch()} /></View>
      ) : (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {openSos ? (
          <SosBanner
            elderName={name}
            at={clockTime(openSos.at, elder.timezone)}
            onPress={() => router.push({ pathname: '/(caregiver)/sos-alert', params: { eventId: openSos.id } })}
          />
        ) : null}

        {/* Alert banner */}
        <AlertBanner
          screenState={screenState}
          elderName={name}
          missedTaskName={firstMissed?.name}
          missedTaskTime={firstMissed?.time}
          onBreachPress={handleBreachPress}
        />

        {/* Right now card */}
        <View>
          <Text style={styles.sectionLabel}>Agora</Text>
          <RightNowCard
            item={currentItem(items)}
            items={items}
            screenState={screenState}
            location={location.data}
            exitResolved={exitResolved}
            timezone={elder.timezone}
            marking={markDone.isPending}
            onMarkDone={handleMarkDone}
            onBreachPress={handleBreachPress}
            onSetupZone={handleSetupZone}
            onOpenLocation={handleOpenLocation}
          />
        </View>

        {/* Timeline */}
        <TimelineScroll items={items} />

        {/* Aurélia insight */}
        <AureliaCard
          screenState={screenState}
          elderName={name}
          firstMissed={firstMissed}
          weekMissed={week.data?.missedCount ?? missedItems.length}
          counts={counts}
        />

        {/* Bottom padding for tab bar */}
        <View style={{ height: 16 }} />
      </ScrollView>
      ))}

      {/* ── Undo snackbar (absolutely positioned, visible over both tabs) ── */}
      {snackbar && (
        <View style={styles.snackbar} pointerEvents="box-none">
          <Text style={styles.snackbarText} numberOfLines={1}>
            ✓ {snackbar.name.split(' ').slice(0, 3).join(' ')} confirmada
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={handleUndoSnackbar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.snackbarUndo}>Desfazer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Demo controls (dev builds in mock mode only; only on Hoje) */}
      {activeTab === 'hoje' && <DevStateSwitcher onRefresh={refetchAll} />}
    </SafeAreaView>
  );
}

const extra = StyleSheet.create({
  chipWarn: { backgroundColor: Colors.warningBg },
  chipWarnText: { color: Colors.warningText },
  chipNeutral: { backgroundColor: Colors.progressBg },
  chipNeutralText: { color: Colors.textSecondary },
});

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
    color: Colors.primaryOnDark,
    marginTop: 2,
  },

  // Status badge
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeOk: {
    backgroundColor: Colors.primaryDark,
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
    color: Colors.primaryOnDark,
  },
  tabPillTextActive: {
    color: Colors.primaryText,
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
  badgeTextOk: { color: Colors.primaryOnDark },
  badgeTextAlert: { color: '#FAC775' },
  badgeTextDanger: { color: '#F09595' },

  // ── Dev switcher ───────────────────────────────────────────────────────────
  devSwitcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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

  // Week selector

  // Aurélia insight card

  // Summary stats row

  // Generic card

  // Day-by-day chart

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
