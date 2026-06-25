/**
 * Aurélia — Perfil tab
 *
 * Sections:
 *  1. Header (title + settings gear → /settings)
 *  2. Elder profile card (avatar, name, age, diagnosis stage, device status)
 *  3. Personal details card
 *  4. Safe-zone card (schematic map + radius step-selector)
 *  5. Emergency contacts (escalation toggle, call, delete, add)
 *  6. Share with family (lavender CTA — stub for v1)
 *  7. Danger zone — remove elder
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useApp } from '@/context/AppContext';
import { Contact } from '@/data/mock';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// ─── Radius presets ───────────────────────────────────────────────────────────

const RADIUS_STEPS = [50, 100, 150, 200, 300, 400, 500] as const;

// ─── Safe-zone map schematic ──────────────────────────────────────────────────

function SafeZoneMap({ radius }: { radius: number }) {
  // Visual scale: smallest radius → smallest circle
  const minR = RADIUS_STEPS[0];
  const maxR = RADIUS_STEPS[RADIUS_STEPS.length - 1];
  const circlePct = 0.30 + 0.55 * ((radius - minR) / (maxR - minR)); // 30%–85% of container
  const MAP_SIZE = 200;
  const circleSize = MAP_SIZE * circlePct;

  return (
    <View style={[styles.mapContainer, { width: MAP_SIZE, height: MAP_SIZE }]}>
      {/* Background */}
      <View style={styles.mapBg} />
      {/* Safe zone dashed circle */}
      <View
        style={[
          styles.safeCircle,
          { width: circleSize, height: circleSize, borderRadius: circleSize / 2 },
        ]}
      />
      {/* Home pin */}
      <View style={styles.homePin}>
        <View style={styles.homePinDot} />
      </View>
      {/* Elder pin (inside zone for profile view) */}
      <View style={[styles.elderPin, { bottom: MAP_SIZE * 0.22, left: MAP_SIZE * 0.52 }]}>
        <View style={styles.elderPinDot} />
      </View>
      {/* Radius label */}
      <View style={styles.radiusLabel}>
        <Text style={styles.radiusLabelText}>{radius}m</Text>
      </View>
    </View>
  );
}

// ─── Contact row ──────────────────────────────────────────────────────────────

function ContactRow({
  contact,
  onToggleEscalation,
  onCall,
  onDelete,
}: {
  contact: Contact;
  onToggleEscalation: (id: string, val: boolean) => void;
  onCall: (phone: string) => void;
  onDelete: (id: string) => void;
}) {
  const handleDelete = useCallback(() => {
    Alert.alert(
      'Remover contato',
      `Remover ${contact.name} da lista de contatos de emergência?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => onDelete(contact.id),
        },
      ],
    );
  }, [contact, onDelete]);

  return (
    <View style={styles.contactRow}>
      {/* Avatar */}
      <View style={styles.contactAvatar}>
        <Text style={styles.contactAvatarText}>{contact.initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.name}</Text>
        <Text style={styles.contactRole}>{contact.role} · {contact.phone}</Text>
        <View style={styles.contactEscRow}>
          <Text style={styles.escLabel}>Escalonar alertas</Text>
          <Switch
            value={contact.escalation}
            onValueChange={(v) => onToggleEscalation(contact.id, v)}
            trackColor={{ false: Colors.borderLight, true: Colors.aureliaBg }}
            thumbColor={contact.escalation ? Colors.aureliaText : Colors.tabInactive}
            ios_backgroundColor={Colors.borderLight}
          />
        </View>
      </View>

      {/* Actions */}
      <View style={styles.contactActions}>
        <TouchableOpacity
          style={styles.callBtn}
          onPress={() => onCall(contact.phone)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="phone.fill" size={14} color={Colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeContactBtn}
          onPress={handleDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="trash" size={14} color={Colors.dangerText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Add contact inline form ──────────────────────────────────────────────────

type NewContact = { name: string; role: string; phone: string };

function AddContactForm({ onSave, onCancel }: { onSave: (c: NewContact) => void; onCancel: () => void }) {
  const [form, setForm] = useState<NewContact>({ name: '', role: '', phone: '' });

  const handleSave = useCallback(() => {
    if (!form.name.trim() || !form.phone.trim()) {
      Alert.alert('Campos obrigatórios', 'Nome e telefone são necessários.');
      return;
    }
    onSave(form);
  }, [form, onSave]);

  return (
    <View style={styles.addForm}>
      <Text style={styles.addFormTitle}>Novo contato</Text>
      <TextInput
        style={styles.addInput}
        placeholder="Nome completo"
        placeholderTextColor={Colors.textSecondary}
        value={form.name}
        onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
        autoFocus
      />
      <TextInput
        style={styles.addInput}
        placeholder="Parentesco ou função (ex: Filha, Médico)"
        placeholderTextColor={Colors.textSecondary}
        value={form.role}
        onChangeText={(v) => setForm((p) => ({ ...p, role: v }))}
      />
      <TextInput
        style={styles.addInput}
        placeholder="Telefone (ex: +55 19 99999-0000)"
        placeholderTextColor={Colors.textSecondary}
        value={form.phone}
        onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))}
        keyboardType="phone-pad"
      />
      <View style={styles.addFormActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveContactBtn} onPress={handleSave}>
          <Text style={styles.saveContactBtnText}>Salvar contato</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function DetailRow({
  label,
  value,
  last,
  danger,
}: {
  label: string;
  value: string;
  last?: boolean;
  danger?: boolean;
}) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, danger && styles.detailValueDanger]}>{value}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PerfilScreen() {
  const { elder, contacts, updateElder, updateContact, addContact, removeContact } = useApp();
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);

  const handleCall = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  }, []);

  const handleToggleEscalation = useCallback(
    (id: string, val: boolean) => {
      updateContact(id, { escalation: val });
    },
    [updateContact],
  );

  const handleSaveContact = useCallback(
    (c: NewContact) => {
      const initials = c.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();
      addContact({ ...c, initials, escalation: false });
      setShowAddForm(false);
    },
    [addContact],
  );

  const handleRemoveContact = useCallback(
    (id: string) => {
      removeContact(id);
    },
    [removeContact],
  );

  const handleRemoveElder = useCallback(() => {
    Alert.alert(
      'Remover perfil do idoso',
      'Esta ação não pode ser desfeita. Todos os dados de Maria Gorete serão apagados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover perfil',
          style: 'destructive',
          onPress: () => Alert.alert('Funcionalidade', 'Disponível após integração com o backend.'),
        },
      ],
    );
  }, []);

  const currentRadius = elder.safeZoneRadius;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Perfil</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/settings')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="gear" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Elder profile card ── */}
        <SectionCard>
          <View style={styles.elderCardContent}>
            <View style={styles.elderAvatar}>
              <Text style={styles.elderAvatarText}>{elder.initials}</Text>
            </View>
            <View style={styles.elderInfo}>
              <Text style={styles.elderName}>{elder.name}</Text>
              <Text style={styles.elderAge}>{elder.age} anos · {elder.diagnosisStage}</Text>
              <View style={styles.deviceRow}>
                <View
                  style={[
                    styles.deviceDot,
                    { backgroundColor: elder.deviceConnected ? Colors.successText : Colors.dangerText },
                  ]}
                />
                <Text style={styles.deviceLabel}>
                  {elder.deviceConnected ? 'Dispositivo conectado' : 'Dispositivo desconectado'}
                </Text>
              </View>
            </View>
          </View>
        </SectionCard>

        {/* ── Personal details ── */}
        <SectionTitle title="Informações pessoais" />
        <SectionCard>
          <DetailRow label="Data de nascimento" value={elder.dateOfBirth} />
          <DetailRow label="Estágio do diagnóstico" value={elder.diagnosisStage} />
          <DetailRow label="Medicações ativas" value={`${elder.activeMedCount} medicações`} />
          <DetailRow
            label="Status do dispositivo"
            value={elder.deviceConnected ? 'Conectado' : 'Desconectado'}
            last
            danger={!elder.deviceConnected}
          />
        </SectionCard>

        {/* ── Safe zone ── */}
        <SectionTitle title="Zona segura" />
        <SectionCard>
          <Text style={styles.safeZoneSub}>
            Maria é monitorada dentro de um raio de <Text style={styles.safeZoneHighlight}>{currentRadius}m</Text> em torno do endereço cadastrado.
          </Text>

          {/* Schematic map */}
          <View style={styles.mapWrap}>
            <SafeZoneMap radius={currentRadius} />
          </View>

          {/* Radius step selector */}
          <Text style={styles.radiusSelectorLabel}>Raio da zona segura</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.radiusRow}
          >
            {RADIUS_STEPS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.radiusStep, currentRadius === r && styles.radiusStepActive]}
                onPress={() => updateElder({ safeZoneRadius: r })}
              >
                <Text style={[styles.radiusStepText, currentRadius === r && styles.radiusStepTextActive]}>
                  {r}m
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.radiusHint}>
            Valores menores aumentam a sensibilidade — útil em ambientes residenciais. Valores maiores reduzem falsos alertas.
          </Text>
        </SectionCard>

        {/* ── Emergency contacts ── */}
        <SectionTitle title="Contatos de emergência" />
        <SectionCard>
          {contacts.map((c, i) => (
            <React.Fragment key={c.id}>
              <ContactRow
                contact={c}
                onToggleEscalation={handleToggleEscalation}
                onCall={handleCall}
                onDelete={handleRemoveContact}
              />
              {i < contacts.length - 1 && <View style={styles.contactDivider} />}
            </React.Fragment>
          ))}

          {/* Inline add form */}
          {showAddForm ? (
            <AddContactForm
              onSave={handleSaveContact}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <TouchableOpacity
              style={styles.addContactBtn}
              onPress={() => setShowAddForm(true)}
              activeOpacity={0.8}
            >
              <IconSymbol name="plus.circle.fill" size={18} color={Colors.primary} />
              <Text style={styles.addContactBtnText}>Adicionar contato de emergência</Text>
            </TouchableOpacity>
          )}
        </SectionCard>

        {/* ── Share with family ── */}
        <SectionTitle title="Compartilhar acesso" />
        <SectionCard>
          <View style={styles.shareCard}>
            <View style={styles.aureliaAvatar}>
              <Text style={styles.aureliaAvatarText}>A</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shareTitle}>Convidar familiar</Text>
              <Text style={styles.shareSub}>
                Permita que um familiar acompanhe o dia de Maria com acesso de leitura. Disponível em breve.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => Alert.alert('Em breve', 'O compartilhamento de acesso estará disponível na próxima versão.')}
            activeOpacity={0.85}
          >
            <IconSymbol name="person.badge.plus" size={16} color={Colors.aureliaText} />
            <Text style={styles.shareBtnText}>Enviar convite</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* ── Danger zone ── */}
        <SectionTitle title="Zona de perigo" />
        <SectionCard>
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={handleRemoveElder}
            activeOpacity={0.8}
          >
            <IconSymbol name="trash" size={16} color={Colors.dangerText} />
            <Text style={styles.dangerRowText}>Remover perfil do idoso</Text>
          </TouchableOpacity>
        </SectionCard>

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
  settingsBtn: {
    padding: 4,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: 0 },

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

  // Elder card
  elderCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  elderAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  elderAvatarText: {
    fontSize: 22,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  elderInfo: { flex: 1, gap: 4 },
  elderName: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  elderAge: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  deviceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  deviceLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
  },

  // Detail rows
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  detailValueDanger: {
    color: Colors.dangerText,
  },

  // Safe zone
  safeZoneSub: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    lineHeight: 20,
  },
  safeZoneHighlight: {
    color: Colors.primary,
    fontWeight: Typography.weight.semibold,
  },
  mapWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  mapContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBg: {
    position: 'absolute',
    inset: 0,
    backgroundColor: '#E8F5F5',
    borderRadius: Radius.lg,
  },
  safeCircle: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(15,128,128,0.07)',
  },
  homePin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homePinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2.5,
    borderColor: Colors.white,
  },
  elderPin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  elderPinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.successText,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  radiusLabel: {
    position: 'absolute',
    top: 8,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  radiusLabelText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.primary,
  },
  radiusSelectorLabel: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  radiusRow: {
    paddingHorizontal: Spacing.md,
    gap: 6,
    flexDirection: 'row',
  },
  radiusStep: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radiusStepActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  radiusStepText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.semibold,
  },
  radiusStepTextActive: {
    color: Colors.primaryText,
  },
  radiusHint: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    lineHeight: 17,
  },

  // Contacts
  contactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  contactAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  contactAvatarText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  contactInfo: { flex: 1, gap: 2 },
  contactName: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  contactRole: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
  },
  contactEscRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  escLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
  },
  contactActions: {
    flexDirection: 'column',
    gap: Spacing.sm,
    alignItems: 'center',
    paddingTop: 2,
  },
  callBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeContactBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactDivider: {
    height: 0.5,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.md,
  },
  addContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: Colors.borderLight,
  },
  addContactBtnText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.primary,
  },

  // Add form
  addForm: {
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: Colors.borderLight,
    marginTop: 4,
  },
  addFormTitle: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  addInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Typography.size.sm,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  addFormActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
  saveContactBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveContactBtnText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.white,
  },

  // Share
  shareCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  aureliaAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.aureliaText,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  aureliaAvatarText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.white,
  },
  shareTitle: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  shareSub: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.aureliaBg,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.aureliaBorder,
  },
  shareBtnText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.aureliaText,
  },

  // Danger
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  dangerRowText: {
    fontSize: Typography.size.base,
    color: Colors.dangerText,
    fontWeight: Typography.weight.semibold,
  },
});
