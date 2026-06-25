/**
 * Aurélia — Configurações (Settings)
 *
 * Pushed from the Profile tab (gear icon).
 *
 * Sections:
 *  1. Header with back button
 *  2. Account row (caregiver info)
 *  3. Notifications card (4 toggles, geo-fence locked)
 *  4. Missed task timeout card (3 chips)
 *  5. Escalation card (2 radio options)
 *  6. App preferences list (stub links)
 *  7. Sign out + version string
 */

import React, { useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useApp } from '@/context/AppContext';
import { AppSettings } from '@/data/mock';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  sublabel,
  value,
  onValueChange,
  locked,
  last,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onValueChange?: (v: boolean) => void;
  locked?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, last && styles.toggleRowLast]}>
      <View style={styles.toggleInfo}>
        <View style={styles.toggleLabelRow}>
          <Text style={styles.toggleLabel}>{label}</Text>
          {locked && (
            <View style={styles.lockedBadge}>
              <IconSymbol name="lock.fill" size={8} color={Colors.warningText} />
              <Text style={styles.lockedBadgeText}>Sempre ativo</Text>
            </View>
          )}
        </View>
        {sublabel && <Text style={styles.toggleSublabel}>{sublabel}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={locked ? undefined : onValueChange}
        disabled={locked}
        trackColor={{ false: Colors.borderLight, true: Colors.primaryLight }}
        thumbColor={value ? Colors.primary : Colors.tabInactive}
        ios_backgroundColor={Colors.borderLight}
      />
    </View>
  );
}

// ─── Timeout chip selector ────────────────────────────────────────────────────

type TimeoutOption = 15 | 30 | 60;
const TIMEOUT_OPTIONS: { value: TimeoutOption; label: string }[] = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hora' },
];

// ─── Link row (preferences) ───────────────────────────────────────────────────

function LinkRow({
  icon,
  label,
  last,
  onPress,
}: {
  icon: IconSymbolName;
  label: string;
  last?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.linkRow, last && styles.linkRowLast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.linkIconWrap}>
        <IconSymbol name={icon} size={16} color={Colors.textSecondary} />
      </View>
      <Text style={styles.linkLabel}>{label}</Text>
      <IconSymbol name="chevron.right" size={14} color={Colors.tabInactive} />
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { settings, updateSettings, caregiver } = useApp();
  const router = useRouter();

  const patchSettings = useCallback(
    (patch: Partial<AppSettings>) => updateSettings(patch),
    [updateSettings],
  );

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sair da conta',
      'Você será desconectado do aplicativo. Os dados de Maria Gorete permanecerão salvos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Funcionalidade', 'Login disponível após integração com o backend.'),
        },
      ],
    );
  }, []);

  const handleStub = useCallback((feature: string) => {
    Alert.alert('Em breve', `${feature} estará disponível na próxima versão.`);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="chevron.left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configurações</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Account ── */}
        <SectionTitle title="Conta" />
        <SectionCard>
          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => handleStub('Edição de conta')}
            activeOpacity={0.7}
          >
            <View style={styles.accountAvatar}>
              <Text style={styles.accountAvatarText}>{caregiver.initials}</Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{caregiver.name}</Text>
              <Text style={styles.accountRole}>{caregiver.role}</Text>
              <Text style={styles.accountEmail}>{caregiver.email}</Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={Colors.tabInactive} />
          </TouchableOpacity>
        </SectionCard>

        {/* ── Notifications ── */}
        <SectionTitle title="Notificações" />
        <SectionCard>
          <ToggleRow
            label="Alertas de geo-fence"
            sublabel="Notificação imediata quando Maria sair da zona segura"
            value={settings.notifyGeofence}
            locked
          />
          <ToggleRow
            label="Tarefas perdidas"
            sublabel="Aviso quando uma tarefa não for confirmada no prazo"
            value={settings.notifyMissedTask}
            onValueChange={(v) => patchSettings({ notifyMissedTask: v })}
          />
          <ToggleRow
            label="Confirmações de tarefas"
            sublabel="Notificação quando Maria confirmar uma tarefa"
            value={settings.notifyConfirmations}
            onValueChange={(v) => patchSettings({ notifyConfirmations: v })}
          />
          <ToggleRow
            label="Insights da Aurélia"
            sublabel="Análises e sugestões automáticas da IA"
            value={settings.notifyAureliaInsights}
            onValueChange={(v) => patchSettings({ notifyAureliaInsights: v })}
            last
          />
        </SectionCard>

        {/* ── Missed task timeout ── */}
        <SectionTitle title="Tolerância para tarefa perdida" />
        <SectionCard>
          <View style={styles.timeoutSection}>
            <Text style={styles.timeoutDesc}>
              Após quantos minutos sem confirmação uma tarefa é marcada como perdida e Aurélia é alertada?
            </Text>
            <View style={styles.timeoutChips}>
              {TIMEOUT_OPTIONS.map((opt) => {
                const active = settings.missedTaskTimeout === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.timeoutChip, active && styles.timeoutChipActive]}
                    onPress={() => patchSettings({ missedTaskTimeout: opt.value })}
                  >
                    <Text style={[styles.timeoutChipText, active && styles.timeoutChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </SectionCard>

        {/* ── Escalation ── */}
        <SectionTitle title="Modo de escalação" />
        <SectionCard>
          <View style={styles.escalationDesc}>
            <Text style={styles.timeoutDesc}>
              Quando um evento crítico ocorre (geo-fence ou tarefa perdida), quem deve ser notificado?
            </Text>
          </View>
          {(
            [
              {
                value: 'me-only' as const,
                label: 'Notificar apenas eu',
                sub: 'Somente você recebe os alertas',
              },
              {
                value: 'me-then-contacts' as const,
                label: 'Notificar eu, depois os contatos',
                sub: 'Se você não responder em 5 minutos, os contatos com escalonamento ativo são avisados',
              },
            ] as const
          ).map((opt, i, arr) => {
            const active = settings.escalationMode === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.radioRow, i === arr.length - 1 && styles.radioRowLast]}
                onPress={() => patchSettings({ escalationMode: opt.value })}
                activeOpacity={0.7}
              >
                <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                  {active && <View style={styles.radioInner} />}
                </View>
                <View style={styles.radioInfo}>
                  <Text style={[styles.radioLabel, active && styles.radioLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.radioSub}>{opt.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </SectionCard>

        {/* ── Preferences ── */}
        <SectionTitle title="Preferências" />
        <SectionCard>
          <LinkRow
            icon="globe"
            label={`Idioma — ${settings.language}`}
            onPress={() => handleStub('Seleção de idioma')}
          />
          <LinkRow
            icon="person.2.fill"
            label="Contatos compartilhados"
            onPress={() => handleStub('Contatos compartilhados')}
          />
          <LinkRow
            icon="lock.shield.fill"
            label="Privacidade e dados"
            onPress={() => handleStub('Configurações de privacidade')}
          />
          <LinkRow
            icon="questionmark.circle.fill"
            label="Ajuda e suporte"
            last
            onPress={() => handleStub('Central de ajuda')}
          />
        </SectionCard>

        {/* ── Sign out ── */}
        <View style={{ height: Spacing.lg }} />
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <IconSymbol name="arrow.right.square" size={16} color={Colors.dangerText} />
          <Text style={styles.signOutText}>Sair da conta</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>Aurélia v1.0.0 · TCC ETEC Bento Quirino</Text>

        <View style={{ height: 32 }} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.md,
  },

  // Section title
  sectionTitle: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    marginHorizontal: 4,
  },

  // Card
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  // Account
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  accountAvatarText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  accountInfo: { flex: 1, gap: 2 },
  accountName: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  accountRole: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
  },
  accountEmail: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
  },

  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
  },
  toggleRowLast: { borderBottomWidth: 0 },
  toggleInfo: { flex: 1 },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  toggleLabel: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  toggleSublabel: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.warningBg,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  lockedBadgeText: {
    fontSize: 9,
    color: Colors.warningText,
    fontWeight: Typography.weight.semibold,
  },

  // Timeout
  timeoutSection: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  timeoutDesc: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  timeoutChips: {
    flexDirection: 'row',
    gap: 8,
  },
  timeoutChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  timeoutChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  timeoutChipText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
  timeoutChipTextActive: {
    color: Colors.primaryText,
  },

  // Escalation
  escalationDesc: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 4,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    borderTopWidth: 0.5,
    borderTopColor: Colors.borderLight,
  },
  radioRowLast: {},
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  radioOuterActive: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  radioInfo: { flex: 1 },
  radioLabel: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  radioLabelActive: {
    color: Colors.primary,
  },
  radioSub: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },

  // Link rows
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
  },
  linkRowLast: { borderBottomWidth: 0 },
  linkIconWrap: {
    width: 28,
    alignItems: 'center',
  },
  linkLabel: {
    flex: 1,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dangerBg,
    borderWidth: 0.5,
    borderColor: Colors.dangerBg,
  },
  signOutText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.dangerText,
  },

  // Version
  version: {
    textAlign: 'center',
    fontSize: Typography.size.xs,
    color: Colors.tabInactive,
    marginTop: Spacing.lg,
  },
});
