/**
 * Aurélia — Geo-fence breach modal
 *
 * Full-screen modal. Highest-stakes screen in the app.
 * gestureEnabled: false is set in _layout.tsx — do not change.
 * Dismissal requires a deliberate two-step confirmation (tap link → confirm alert).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useApp } from '@/context/AppContext';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(from: Date | null): string {
  if (!from) return '—';
  const diffMs = Date.now() - from.getTime();
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s atrás`;
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}min atrás`;
}

function formatTime(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Map placeholder ──────────────────────────────────────────────────────────
// Schematic representation. Replace with react-native-maps in production.

function MapPlaceholder() {
  return (
    <View style={styles.mapContainer}>
      {/* Safe-zone circle */}
      <View style={styles.safeZoneCircle} />

      {/* Home pin (teal) */}
      <View style={styles.homePin}>
        <View style={styles.homePinDot} />
        <Text style={styles.homePinLabel}>Casa</Text>
      </View>

      {/* Elder pin — outside safe zone (red) */}
      <View style={styles.elderPin}>
        <View style={styles.elderPinDot} />
        <Text style={styles.elderPinLabel}>Maria</Text>
      </View>

      {/* Open map affordance */}
      <TouchableOpacity style={styles.mapOpenBtn} activeOpacity={0.8}>
        <IconSymbol name="map.fill" size={11} color={Colors.primary} />
        <Text style={styles.mapOpenBtnText}>Abrir mapa completo</Text>
      </TouchableOpacity>
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function GeoFenceBreachScreen() {
  const { elder, breachTimestamp, resolveBreach } = useApp();
  const router = useRouter();

  // Live elapsed timer — ticks every second
  const [elapsed, setElapsed] = useState(() => formatElapsed(breachTimestamp));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed(formatElapsed(breachTimestamp));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [breachTimestamp]);

  // Two-step dismiss — tap link → confirm alert
  const handleDismissRequest = useCallback(() => {
    Alert.alert(
      'Confirmar dispensa',
      `Tem certeza que Maria está segura e deseja dispensar o alerta?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, ela está segura',
          style: 'destructive',
          onPress: () => {
            resolveBreach();
            router.back();
          },
        },
      ],
      { cancelable: false },
    );
  }, [resolveBreach, router]);

  // Call elder
  const handleCall = useCallback(() => {
    const phone = `tel:+5519999991111`; // In production: from contacts list
    Linking.canOpenURL(phone).then((supported) => {
      if (supported) Linking.openURL(phone);
    });
  }, []);

  // Share location (stub — would open share sheet in production)
  const handleShare = useCallback(() => {
    Alert.alert(
      'Compartilhar localização',
      'Isso enviaria a localização atual de Maria para os contatos de escalonamento. (Funcionalidade completa requer backend.)',
      [{ text: 'OK' }],
    );
  }, []);

  // Emergency (stub)
  const handleEmergency = useCallback(() => {
    Alert.alert(
      'Serviço de emergência',
      'Deseja ligar para o SAMU (192)?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ligar 192',
          onPress: () => Linking.openURL('tel:192'),
        },
      ],
    );
  }, []);

  const detectionTime = breachTimestamp ? formatTime(breachTimestamp) : '—';

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
          <View style={styles.elapsedBadge}>
            <Text style={styles.elapsedText}>{elapsed}</Text>
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
        <MapPlaceholder />

        {/* Info card */}
        <View style={styles.card}>
          <InfoRow label="Última localização" value="~80m fora do raio seguro" danger />
          <InfoRow label="Saída detectada às" value={detectionTime} />
          <InfoRow label="Distância da zona" value="~80 metros" />
          <InfoRow label="Dispositivo" value={elder.deviceConnected ? 'Ativo · sinal OK' : 'Último sinal há 5 min'} last />
        </View>

        {/* Aurélia card — operational tone */}
        <View style={styles.aureliaCard}>
          <View style={styles.aureliaAvatar}>
            <Text style={styles.aureliaAvatarText}>A</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aureliaName}>Aurélia</Text>
            <Text style={styles.aureliaText}>
              Maria se moveu em direção ao norte após sair da zona. Estou enviando alertas pelo dispositivo dela. Recomendo ligar agora.
            </Text>
          </View>
        </View>

        {/* Primary action */}
        <TouchableOpacity style={styles.btnCall} onPress={handleCall} activeOpacity={0.85}>
          <IconSymbol name="phone.fill" size={18} color={Colors.white} />
          <Text style={styles.btnCallText}>Ligar para {elder.name} agora</Text>
        </TouchableOpacity>

        {/* Secondary actions */}
        <View style={styles.secondaryRow}>
          <TouchableOpacity style={styles.btnSecondary} onPress={handleShare} activeOpacity={0.8}>
            <IconSymbol name="square.and.arrow.up" size={16} color={Colors.textPrimary} />
            <Text style={styles.btnSecondaryText}>Compartilhar{'\n'}localização</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSecondary, styles.btnEmergency]}
            onPress={handleEmergency}
            activeOpacity={0.8}
          >
            <IconSymbol name="exclamationmark.triangle.fill" size={16} color={Colors.dangerText} />
            <Text style={[styles.btnSecondaryText, styles.btnEmergencyText]}>Emergência{'\n'}(SAMU 192)</Text>
          </TouchableOpacity>
        </View>

        {/* Two-step dismiss link */}
        <TouchableOpacity onPress={handleDismissRequest} activeOpacity={0.7} style={styles.dismissWrap}>
          <Text style={styles.dismissLink}>Ela está segura — dispensar alerta</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

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

  // ── Map placeholder ─────────────────────────────────────────────────────────
  mapContainer: {
    width: '100%',
    height: 160,
    backgroundColor: '#D8E8F4',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  safeZoneCircle: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.successBorder,
    backgroundColor: 'rgba(225,245,238,0.5)',
    top: 30,
    left: 28,
  },
  homePin: {
    position: 'absolute',
    top: 62,
    left: 60,
    alignItems: 'center',
  },
  homePinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  homePinLabel: {
    fontSize: 8,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  elderPin: {
    position: 'absolute',
    top: 90,
    left: 195,
    alignItems: 'center',
  },
  elderPinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.dangerDot,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  elderPinLabel: {
    fontSize: 8,
    color: Colors.dangerText,
    fontWeight: '700',
    marginTop: 2,
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
