/**
 * Aurélia — Geo-fence breach modal
 *
 * Full-screen modal. Highest-stakes screen in the app.
 * gestureEnabled: false is set in the layout — do not change.
 * Resolving ("ela está segura") needs a deliberate two-step confirmation (tap link → confirm).
 *
 * "Estou cuidando disso" acknowledges the exit, so the emergency contacts are not texted for it.
 *
 * Opened from the push for `geofenceExit` or from the banner on Início. Everything on it comes from
 * the API: how long she has been outside (`locationState.since`), where she was last seen, and
 * who to call (the elder's contacts, emergency ones first).
 */

import { haversineMeters, type Contact, type SafeZone } from '@aurelia/shared';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AlertResponse, ErrorState, FormError, LoadingState } from '@/components';
import { SafeZoneMap } from '@/components/SafeZoneMap';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { confirm } from '@/lib/confirm';
import { ApiError } from '@/lib/api/client';
import { friendlyError } from '@/lib/errors';
import { clockTime, firstName, formatElapsed, formatPhone, formatStopwatch, mapsUrl } from '@/lib/format';
import {
  useAcknowledgeAlert,
  useContacts,
  useCurrentElder,
  useEscalatesToContacts,
  useLatestExit,
  useLocation,
  useNow,
  useResolveGeofence,
} from '@/queries';
import { Colors, Radius, Spacing, Typography } from '@/theme';

// ─── Map ──────────────────────────────────────────────────────────────────────
// The real map (safe-zone circle + last position, refreshed with the location query every 30 s);
// "Abrir no mapa" still hands the point to the phone's maps app for directions.

function BreachMap({
  zone,
  position,
  elderName,
  onOpen,
}: {
  zone: SafeZone | null;
  position: { lat: number; lng: number } | null;
  elderName: string;
  onOpen: (() => void) | null;
}) {
  return (
    <View style={styles.mapContainer}>
      <SafeZoneMap zone={zone} position={position} status="outside" elderName={elderName} height={220} />
      {onOpen ? (
        <TouchableOpacity style={styles.mapOpenBtn} activeOpacity={0.8} onPress={onOpen} accessibilityRole="link">
          <IconSymbol name="map.fill" size={11} color={Colors.primary} />
          <Text style={styles.mapOpenBtnText}>Abrir no mapa</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({
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
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, danger && styles.infoValueDanger]}>{value}</Text>
    </View>
  );
}

/** Emergency contacts first, then the rest, each group in priority order (the API already sorts by priority). */
function callOrder(contacts: Contact[]): Contact[] {
  return [...contacts.filter((c) => c.isEmergency), ...contacts.filter((c) => !c.isEmergency)];
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function GeoFenceBreachScreen() {
  const elder = useCurrentElder();
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const location = useLocation(elder.id);
  const outside = location.data?.status === 'outside';
  const latestExit = useLatestExit(elder.id, true);
  const contacts = useContacts(elder.id);
  const resolve = useResolveGeofence(elder.id);
  const acknowledge = useAcknowledgeAlert(elder.id);
  const escalates = useEscalatesToContacts(elder.id);
  const now = useNow(1000);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const name = firstName(elder.name);
  const exit = latestExit.data;
  const eventId = params.eventId ?? exit?.id;
  const resolved = exit?.payload.resolvedAt != null;
  const order = useMemo(() => callOrder(contacts.data?.items ?? []), [contacts.data]);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(caregiver)/(tabs)');
  }, [router]);

  // Two-step resolve — tap link → confirm
  const handleResolve = useCallback(async () => {
    const ok = await confirm(
      'Confirmar',
      `Tem certeza que ${name} está segura e deseja dispensar o alerta?`,
      'Sim, está segura',
      true,
    );
    if (!ok) return;
    setResolveError(null);
    resolve.mutate(
      { eventId },
      {
        onSuccess: leave,
        // Someone else already confirmed it: the alert is over either way.
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'CONFLICT') leave();
          else setResolveError(friendlyError(error));
        },
      },
    );
  }, [name, eventId, resolve, leave]);

  // "Estou cuidando disso": the other caregivers see who, and the emergency contacts are not texted.
  const handleAcknowledge = useCallback(() => {
    if (!exit) return;
    setResolveError(null);
    acknowledge.mutate(exit.id, { onError: (error) => setResolveError(friendlyError(error)) });
  }, [exit, acknowledge]);

  const handleCall = useCallback((phone: string) => {
    void Linking.openURL(`tel:${phone}`);
  }, []);

  const lat = location.data?.lat ?? null;
  const lng = location.data?.lng ?? null;
  const position = useMemo(() => (lat !== null && lng !== null ? { lat, lng } : null), [lat, lng]);

  const handleOpenMap = useCallback(() => {
    if (position) void Linking.openURL(mapsUrl(position.lat, position.lng));
  }, [position]);

  const handleShare = useCallback(async () => {
    if (!position) return;
    try {
      await Share.share({ message: `Última localização de ${elder.name}: ${mapsUrl(position.lat, position.lng)}` });
    } catch {
      Alert.alert('Compartilhar localização', 'Não foi possível compartilhar agora.');
    }
  }, [position, elder.name]);

  // Emergency services
  const handleEmergency = useCallback(async () => {
    const ok = await confirm('Serviço de emergência', 'Deseja ligar para o SAMU (192)?', 'Ligar 192');
    if (ok) void Linking.openURL('tel:192');
  }, []);

  if (location.isPending || latestExit.isPending) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState />
      </SafeAreaView>
    );
  }
  if (location.isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ErrorState message={friendlyError(location.error)} onRetry={() => void location.refetch()} />
        <TouchableOpacity onPress={leave} style={styles.dismissWrap}>
          <Text style={styles.dismissLink}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Nothing left to act on: she is back, or someone already confirmed the exit.
  if (!outside || resolved) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={extra.settled}>
          <IconSymbol name="checkmark.circle.fill" size={48} color={Colors.successText} />
          <Text style={extra.settledTitle}>{outside ? `${name} foi confirmada como segura` : `${name} está na zona segura`}</Text>
          <Text style={extra.settledSub}>
            {outside
              ? 'O alerta foi resolvido. Você será avisado de novo se ela voltar a sair.'
              : 'Não há saída ativa. Você será avisado se ela sair do raio seguro.'}
          </Text>
          <TouchableOpacity style={styles.btnCall} onPress={leave} activeOpacity={0.85} accessibilityRole="button">
            <Text style={styles.btnCallText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const since = location.data?.since ? Date.parse(location.data.since) : exit ? Date.parse(exit.at) : null;
  const zone = location.data?.safeZone ?? null;
  const metersOutside = position && zone ? Math.max(0, Math.round(haversineMeters(position, zone) - zone.radiusM)) : null;
  const lastSeen = location.data?.deviceLastSeenAt ? Date.parse(location.data.deviceLastSeenAt) : null;
  const primary = order[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dangerHeader} />

      {/* Red header */}
      <View style={styles.redHeader}>
        <View style={styles.redHeaderTop}>
          <View style={styles.alertIconWrap}>
            <IconSymbol name="location.slash.fill" size={20} color={Colors.dangerBg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.breachTitle}>{elder.name} saiu da zona segura</Text>
            <Text style={styles.breachSub}>Saída da zona segura detectada</Text>
          </View>
          <View style={styles.elapsedBadge} accessibilityLabel="Tempo fora da zona segura">
            <Text style={styles.elapsedText}>{since === null ? '—' : formatStopwatch(now.getTime() - since)}</Text>
          </View>
        </View>
      </View>

      {/* Scrollable body */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Map */}
        <BreachMap zone={zone} position={position} elderName={name} onOpen={position ? handleOpenMap : null} />

        {/* Info card */}
        <View style={styles.card}>
          <InfoRow
            label="Última localização"
            value={metersOutside !== null ? `~${metersOutside} m fora do raio seguro` : 'Sem posição recente'}
            danger={metersOutside !== null}
          />
          <InfoRow label="Saída detectada às" value={since === null ? '—' : clockTime(new Date(since).toISOString(), elder.timezone)} />
          <InfoRow
            label="Distância do centro"
            value={exit ? `~${Math.round(exit.payload.distanceM)} m` : position && zone ? `~${Math.round(haversineMeters(position, zone))} m` : '—'}
          />
          <InfoRow
            label="Rastreador"
            value={lastSeen === null ? 'Sem sinal registrado' : `Último sinal há ${formatElapsed(now.getTime() - lastSeen)}`}
            last
          />
        </View>

        <AlertResponse
          alert={exit ?? undefined}
          timezone={elder.timezone}
          now={now}
          escalates={escalates}
          action={{ title: 'Estou cuidando disso', onPress: handleAcknowledge, loading: acknowledge.isPending }}
        />

        {/* Primary action: call the first emergency contact */}
        {primary ? (
          <TouchableOpacity style={styles.btnCall} onPress={() => handleCall(primary.phone)} activeOpacity={0.85} accessibilityRole="button">
            <IconSymbol name="phone.fill" size={18} color={Colors.white} />
            <Text style={styles.btnCallText}>Ligar para {primary.name} ({primary.relation})</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.btnCall}
            onPress={() => router.push('/(caregiver)/(tabs)/profile')}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <IconSymbol name="person.fill" size={18} color={Colors.white} />
            <Text style={styles.btnCallText}>Cadastrar um contato para ligar</Text>
          </TouchableOpacity>
        )}

        {/* The other contacts */}
        {order.slice(1).map((contact) => (
          <TouchableOpacity
            key={contact.id}
            style={extra.contactRow}
            onPress={() => handleCall(contact.phone)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Ligar para ${contact.name}`}
          >
            <IconSymbol name="phone.fill" size={14} color={Colors.primary} />
            <Text style={extra.contactName}>{contact.name} · {contact.relation}</Text>
            <Text style={extra.contactPhone}>{formatPhone(contact.phone)}</Text>
          </TouchableOpacity>
        ))}

        {/* Secondary actions */}
        <View style={styles.secondaryRow}>
          <TouchableOpacity
            style={[styles.btnSecondary, !position && { opacity: 0.5 }]}
            onPress={() => void handleShare()}
            disabled={!position}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <IconSymbol name="square.and.arrow.up" size={16} color={Colors.textPrimary} />
            <Text style={styles.btnSecondaryText}>Compartilhar{'\n'}localização</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSecondary, styles.btnEmergency]}
            onPress={() => void handleEmergency()}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <IconSymbol name="exclamationmark.triangle.fill" size={16} color={Colors.dangerText} />
            <Text style={[styles.btnSecondaryText, styles.btnEmergencyText]}>Emergência{'\n'}(SAMU 192)</Text>
          </TouchableOpacity>
        </View>

        <FormError message={resolveError} />

        {/* Two-step resolve link */}
        <TouchableOpacity
          onPress={() => void handleResolve()}
          disabled={resolve.isPending}
          activeOpacity={0.7}
          style={styles.dismissWrap}
          accessibilityRole="button"
        >
          <Text style={styles.dismissLink}>{resolve.isPending ? 'Resolvendo…' : 'Ela está segura — dispensar alerta'}</Text>
        </TouchableOpacity>

        {/* Leaving without resolving keeps the alert on Início */}
        <TouchableOpacity onPress={leave} activeOpacity={0.7} style={styles.dismissWrap} accessibilityRole="button">
          <Text style={extra.keepLink}>Manter o alerta e voltar</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const extra = StyleSheet.create({
  settled: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.xxl },
  settledTitle: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: Colors.textPrimary, textAlign: 'center' },
  settledSub: { fontSize: Typography.size.base, color: Colors.textSecondary, textAlign: 'center' },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  contactName: { flex: 1, fontSize: Typography.size.sm, color: Colors.textPrimary },
  contactPhone: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  keepLink: { fontSize: Typography.size.sm, color: Colors.textSecondary },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dangerHeader,
  },

  // ── Red header ─────────────────────────────────────────────────────────────
  redHeader: {
    backgroundColor: Colors.dangerHeader,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  redHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  alertIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  breachTitle: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.bold,
    color: Colors.dangerBg,
    lineHeight: 20,
  },
  breachSub: {
    fontSize: Typography.size.xs,
    color: '#F09595',
    marginTop: 2,
  },
  elapsedBadge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  elapsedText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: '#F09595',
  },

  // ── Scroll body ─────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // ── Map ─────────────────────────────────────────────────────────────────────
  mapContainer: {
    width: '100%',
    position: 'relative',
  },
  mapOpenBtn: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  mapOpenBtnText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.primary,
  },

  // ── Info card ───────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: Spacing.sm,
  },
  infoValueDanger: {
    color: Colors.dangerText,
  },

  // ── Aurélia card ────────────────────────────────────────────────────────────
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
  aureliaText: {
    fontSize: Typography.size.sm,
    color: Colors.textPrimary,
    lineHeight: 18,
  },

  // ── Buttons ─────────────────────────────────────────────────────────────────
  btnCall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
  },
  btnCallText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.white,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  btnSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.white,
  },
  btnEmergency: {
    borderColor: Colors.dangerBorder,
    backgroundColor: Colors.dangerBg,
  },
  btnSecondaryText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 16,
  },
  btnEmergencyText: {
    color: Colors.dangerText,
  },

  // ── Dismiss ─────────────────────────────────────────────────────────────────
  dismissWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dismissLink: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
