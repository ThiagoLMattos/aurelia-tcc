/**
 * Aurélia — Perfil tab
 *
 * Sections:
 *  1. Header (title + settings gear → /settings)
 *  2. Elder card (avatar, name, age, stage, tracker status) with inline edit
 *  3. Personal details card
 *  4. Elder's phone (pair / unpair)
 *  4b. Caregivers (who follows the elder, invite, remove / leave)
 *  4c. About the elder, for Aurélia, and what she remembers from their conversations
 *  5. Safe zone and tracker rows (open their own screens)
 *  6. Contacts (emergency switch, call, delete, add)
 */

import {
  CreateContactBodySchema,
  DiagnosisStageSchema,
  ELDER_ABOUT_MAX_CHARS,
  LABELS_PT,
  PatchElderBodySchema,
  type Contact,
  type DiagnosisStage,
  type ElderCaregiver,
  type Elder,
  type ElderDetailResponse,
} from '@aurelia/shared';
import React, { useCallback, useMemo, useState } from 'react';
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

import { useMe } from '@/auth/useMe';
import { Button, ErrorState, FormError, LoadingState, TextField } from '@/components';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { confirm } from '@/lib/confirm';
import { friendlyError } from '@/lib/errors';
import { ageOf, firstName, formatElapsed, formatPhone, initials } from '@/lib/format';
import { brDateToIso, maskBrDate, validateForm } from '@/lib/forms';
import {
  useCaregivers,
  useContacts,
  useCreateContact,
  useCurrentElder,
  useDeleteContact,
  useElderDetail,
  useNow,
  usePatchContact,
  usePatchElder,
  useRoutines,
  useRemoveCaregiver,
  useUnpairElderPhone,
} from '@/queries';
import { Colors, Radius, Spacing, Typography } from '@/theme';

/** A tracker that has not reported for this long is shown as having no signal (matches the API's offline check). */
const DEVICE_OFFLINE_AFTER_MS = 15 * 60_000;

const isoToBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// ─── Tracker status ───────────────────────────────────────────────────────────

function trackerStatus(detail: ElderDetailResponse | undefined, now: number): { label: string; ok: boolean } {
  if (!detail) return { label: 'Verificando rastreador…', ok: false };
  if (detail.devices.length === 0) return { label: 'Nenhum rastreador cadastrado', ok: false };
  const seen = detail.devices
    .map((d) => (d.lastSeenAt ? Date.parse(d.lastSeenAt) : 0))
    .reduce((latest, at) => Math.max(latest, at), 0);
  if (seen === 0) return { label: 'Rastreador ainda sem sinal', ok: false };
  const age = now - seen;
  return age <= DEVICE_OFFLINE_AFTER_MS
    ? { label: 'Rastreador conectado', ok: true }
    : { label: `Rastreador sem sinal há ${formatElapsed(age)}`, ok: false };
}

// ─── Contact row ──────────────────────────────────────────────────────────────

function ContactRow({
  contact,
  busy,
  onToggleEmergency,
  onCall,
  onDelete,
}: {
  contact: Contact;
  busy: boolean;
  onToggleEmergency: (contact: Contact, value: boolean) => void;
  onCall: (phone: string) => void;
  onDelete: (contact: Contact) => void;
}) {
  return (
    <View style={styles.contactRow}>
      {/* Avatar */}
      <View style={styles.contactAvatar}>
        <Text style={styles.contactAvatarText}>{initials(contact.name)}</Text>
      </View>

      {/* Info */}
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.name}</Text>
        <Text style={styles.contactRole}>{contact.relation} · {formatPhone(contact.phone)}</Text>
        <View style={styles.contactEscRow}>
          <Text style={styles.escLabel}>Contato de emergência</Text>
          <Switch
            value={contact.isEmergency}
            disabled={busy}
            onValueChange={(v) => onToggleEmergency(contact, v)}
            trackColor={{ false: Colors.borderLight, true: Colors.aureliaBg }}
            thumbColor={contact.isEmergency ? Colors.aureliaText : Colors.tabInactive}
            ios_backgroundColor={Colors.borderLight}
            accessibilityLabel={`${contact.name} é contato de emergência`}
          />
        </View>
      </View>

      {/* Actions */}
      <View style={styles.contactActions}>
        <TouchableOpacity
          style={styles.callBtn}
          onPress={() => onCall(contact.phone)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Ligar para ${contact.name}`}
        >
          <IconSymbol name="phone.fill" size={14} color={Colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeContactBtn}
          onPress={() => onDelete(contact)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Remover ${contact.name}`}
        >
          <IconSymbol name="trash" size={14} color={Colors.dangerText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Caregivers ───────────────────────────────────────────────────────────────

/** Everyone who follows the elder. Any of them can invite someone, remove someone else, or leave. */
function CaregiversSection({ elder }: { elder: Elder }) {
  const router = useRouter();
  const me = useMe();
  const caregivers = useCaregivers(elder.id);
  const remove = useRemoveCaregiver(elder.id);
  const myId = me.data?.role === 'caregiver' ? me.data.caregiver.id : null;
  const name = firstName(elder.name);
  const items = caregivers.data?.items ?? [];

  async function handleRemove(person: ElderCaregiver) {
    const leaving = person.id === myId;
    const ok = leaving
      ? await confirm(
          'Deixar de acompanhar',
          `Você não vai mais ver nem receber alertas de ${name}. Para voltar, precisará de um novo convite.`,
          'Sair',
          true,
        )
      : await confirm('Remover cuidador', `${person.name} não vai mais acompanhar ${name} nem receber os alertas.`, 'Remover', true);
    if (!ok) return;
    remove.mutate(person.id, { onError: (error) => Alert.alert(leaving ? 'Não foi possível sair' : 'Não foi possível remover', friendlyError(error)) });
  }

  if (caregivers.isPending) return <LoadingState />;
  if (caregivers.isError) return <ErrorState message={friendlyError(caregivers.error)} onRetry={() => void caregivers.refetch()} />;

  return (
    <>
      {items.map((person, i) => {
        const isMe = person.id === myId;
        return (
          <React.Fragment key={person.id}>
            <View style={styles.contactRow}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>{initials(person.name)}</Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{isMe ? `${person.name} (você)` : person.name}</Text>
                <Text style={styles.contactRole}>{person.email}</Text>
              </View>
              {items.length > 1 ? (
                isMe ? (
                  <TouchableOpacity onPress={() => void handleRemove(person)} disabled={remove.isPending} accessibilityRole="button">
                    <Text style={extra.leaveText}>Sair</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.removeContactBtn}
                    onPress={() => void handleRemove(person)}
                    disabled={remove.isPending}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={`Remover ${person.name}`}
                  >
                    <IconSymbol name="trash" size={14} color={Colors.dangerText} />
                  </TouchableOpacity>
                )
              ) : null}
            </View>
            {i < items.length - 1 && <View style={styles.contactDivider} />}
          </React.Fragment>
        );
      })}
      {items.length === 1 ? (
        <Text style={extra.explain}>Só você acompanha {name}. Convide outra pessoa da família para dividir os cuidados.</Text>
      ) : null}
      <TouchableOpacity
        style={styles.addContactBtn}
        onPress={() => router.push('/(caregiver)/invite-caregiver')}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <IconSymbol name="plus.circle.fill" size={18} color={Colors.primary} />
        <Text style={styles.addContactBtnText}>Convidar cuidador</Text>
      </TouchableOpacity>
    </>
  );
}

// ─── About the elder (for Aurélia) ─────────────────────────────────────────────

const ABOUT_PLACEHOLDER =
  'Ex.: Foi professora por 30 anos. Tem dois filhos, Ana e Paulo, e a neta Júlia. Adora samba, novela e a gata Mimi. ' +
  'Fica ansiosa no fim da tarde; acalma conversar sobre a fazenda onde cresceu. Gosta de ser chamada de Dona Maria.';

/** What the family tells Aurélia about the elder; she reads it in every conversation. */
function AboutSection({ elder }: { elder: Elder }) {
  const router = useRouter();
  const patch = usePatchElder(elder.id);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(elder.about);
  const [error, setError] = useState<string | null>(null);
  const name = firstName(elder.name);

  function startEditing() {
    setText(elder.about);
    setError(null);
    setEditing(true);
  }

  function save() {
    setError(null);
    patch.mutate(
      { about: text.trim() },
      { onSuccess: () => setEditing(false), onError: (saveError) => setError(friendlyError(saveError)) },
    );
  }

  return (
    <>
      {editing ? (
        <View style={extra.editForm}>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={ELDER_ABOUT_MAX_CHARS}
            placeholder={ABOUT_PLACEHOLDER}
            placeholderTextColor={Colors.textMuted}
            style={extra.aboutInput}
            accessibilityLabel={`Sobre ${name}`}
            autoFocus
          />
          <Text style={extra.counter}>
            {text.length}/{ELDER_ABOUT_MAX_CHARS}
          </Text>
          <FormError message={error} />
          <View style={styles.addFormActions}>
            <Button title="Cancelar" variant="ghost" onPress={() => setEditing(false)} style={{ flex: 1 }} />
            <Button title="Salvar" onPress={save} loading={patch.isPending} style={{ flex: 1 }} />
          </View>
        </View>
      ) : elder.about ? (
        <TouchableOpacity onPress={startEditing} accessibilityRole="button" accessibilityLabel={`Editar o texto sobre ${name}`}>
          <Text style={extra.aboutText}>{elder.about}</Text>
          <Text style={extra.editLink}>Editar</Text>
        </TouchableOpacity>
      ) : (
        <>
          <Text style={extra.explain}>
            Conte para a Aurélia quem é {name}: família, profissão, lembranças queridas, gostos e como gosta que falem com {name}.
            Ela usa isso para conversar e para ajudar a lembrar.
          </Text>
          <Button title="Escrever" variant="secondary" onPress={startEditing} />
        </>
      )}
      <View style={styles.contactDivider} />
      <NavRow
        title="O que a Aurélia lembra"
        value={`Resumos das conversas com ${name}`}
        onPress={() => router.push('/(caregiver)/aurelia-memories')}
      />
    </>
  );
}

// ─── Add contact inline form ──────────────────────────────────────────────────

function AddContactForm({ elderId, nextPriority, onDone }: { elderId: string; nextPriority: number; onDone: () => void }) {
  const create = useCreateContact(elderId);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    const result = validateForm(
      CreateContactBodySchema,
      { name, relation, phone, isEmergency: true, priority: nextPriority },
      {
        name: 'Informe o nome do contato.',
        relation: 'Informe o parentesco ou a função (ex: Filha, Médico).',
        phone: 'Use um telefone com DDD (ex: (11) 99999-0000).',
      },
    );
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    create.mutate(result.data, { onSuccess: onDone, onError: (error) => setSubmitError(friendlyError(error)) });
  }, [name, relation, phone, nextPriority, create, onDone]);

  return (
    <View style={styles.addForm}>
      <Text style={styles.addFormTitle}>Novo contato</Text>
      <TextField label="Nome completo" value={name} onChangeText={setName} error={errors.name} autoFocus autoCapitalize="words" />
      <TextField
        label="Parentesco ou função"
        placeholder="ex: Filha, Médico"
        value={relation}
        onChangeText={setRelation}
        error={errors.relation}
        autoCapitalize="sentences"
      />
      <TextField
        label="Telefone"
        placeholder="(11) 99999-0000"
        value={phone}
        onChangeText={setPhone}
        error={errors.phone}
        keyboardType="phone-pad"
      />
      <FormError message={submitError} />
      <View style={styles.addFormActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onDone}>
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveContactBtn} onPress={handleSave} disabled={create.isPending} accessibilityRole="button">
          <Text style={styles.saveContactBtnText}>{create.isPending ? 'Salvando…' : 'Salvar contato'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Elder edit form ──────────────────────────────────────────────────────────

function EditElderForm({ elder, onDone }: { elder: Elder; onDone: () => void }) {
  const patch = usePatchElder(elder.id);
  const [name, setName] = useState(elder.name);
  const [birth, setBirth] = useState(isoToBr(elder.birthDate));
  const [stage, setStage] = useState<DiagnosisStage>(elder.diagnosisStage);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    const result = validateForm(
      PatchElderBodySchema,
      { name, birthDate: brDateToIso(birth), diagnosisStage: stage },
      { name: 'Informe o nome.', birthDate: 'Informe uma data válida (DD/MM/AAAA).' },
    );
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    patch.mutate(result.data, { onSuccess: onDone, onError: (error) => setSubmitError(friendlyError(error)) });
  }, [name, birth, stage, patch, onDone]);

  return (
    <View style={extra.editForm}>
      <TextField label="Nome" value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
      <TextField
        label="Data de nascimento"
        placeholder="DD/MM/AAAA"
        value={birth}
        onChangeText={(v) => setBirth(maskBrDate(v))}
        error={errors.birthDate}
        keyboardType="number-pad"
      />
      <Text style={extra.chipsLabel}>Estágio do diagnóstico</Text>
      <View style={extra.chips}>
        {DiagnosisStageSchema.options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[extra.chip, stage === option && extra.chipActive]}
            onPress={() => setStage(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: stage === option }}
          >
            <Text style={[extra.chipText, stage === option && extra.chipTextActive]}>{LABELS_PT.diagnosisStage[option]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FormError message={submitError} />
      <View style={styles.addFormActions}>
        <Button title="Cancelar" variant="ghost" onPress={onDone} style={{ flex: 1 }} />
        <Button title="Salvar" onPress={handleSave} loading={patch.isPending} style={{ flex: 1 }} />
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

/** A tappable row that opens another screen. */
function NavRow({ title, value, onPress }: { title: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={extra.navRow} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <View style={{ flex: 1 }}>
        <Text style={extra.navTitle}>{title}</Text>
        <Text style={extra.navValue}>{value}</Text>
      </View>
      <IconSymbol name="chevron.right" size={14} color={Colors.tabInactive} />
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PerfilScreen() {
  const elder = useCurrentElder();
  const router = useRouter();
  const detail = useElderDetail(elder.id);
  const contacts = useContacts(elder.id);
  const routines = useRoutines(elder.id);
  const patchContact = usePatchContact(elder.id);
  const removeContact = useDeleteContact(elder.id);
  const unpair = useUnpairElderPhone(elder.id);
  const [editing, setEditing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const name = firstName(elder.name);
  const items = useMemo(() => contacts.data?.items ?? [], [contacts.data]);
  const nextPriority = Math.min(1000, items.reduce((max, c) => Math.max(max, c.priority), 0) + 1);
  const activeMeds = routines.data?.items.filter((r) => r.type === 'medication').length;
  const now = useNow();
  const tracker = trackerStatus(detail.data, now.getTime());

  const handleCall = useCallback((phone: string) => {
    void Linking.openURL(`tel:${phone}`);
  }, []);

  const handleToggleEmergency = useCallback(
    (contact: Contact, value: boolean) => {
      patchContact.mutate(
        { contactId: contact.id, body: { isEmergency: value } },
        { onError: (error) => Alert.alert('Não foi possível alterar', friendlyError(error)) },
      );
    },
    [patchContact],
  );

  const handleRemoveContact = useCallback(
    async (contact: Contact) => {
      const ok = await confirm('Remover contato', `Remover ${contact.name} da lista de contatos?`, 'Remover', true);
      if (!ok) return;
      removeContact.mutate(contact.id, { onError: (error) => Alert.alert('Não foi possível remover', friendlyError(error)) });
    },
    [removeContact],
  );

  const handleUnpair = useCallback(async () => {
    const ok = await confirm(
      'Desparear celular',
      `O celular de ${name} será desconectado e vai precisar de um novo código para entrar de novo.`,
      'Desparear',
      true,
    );
    if (!ok) return;
    unpair.mutate(undefined, { onError: (error) => Alert.alert('Não foi possível desparear', friendlyError(error)) });
  }, [name, unpair]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Perfil</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/(caregiver)/settings')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Configurações"
        >
          <IconSymbol name="gear" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Elder profile card ── */}
        <SectionCard>
          <View style={styles.elderCardContent}>
            <View style={styles.elderAvatar}>
              <Text style={styles.elderAvatarText}>{initials(elder.name)}</Text>
            </View>
            <View style={styles.elderInfo}>
              <Text style={styles.elderName}>{elder.name}</Text>
              <Text style={styles.elderAge}>{ageOf(elder.birthDate)} anos · {LABELS_PT.diagnosisStage[elder.diagnosisStage]}</Text>
              <View style={styles.deviceRow}>
                <View
                  style={[
                    styles.deviceDot,
                    { backgroundColor: tracker.ok ? Colors.successText : Colors.dangerText },
                  ]}
                />
                <Text style={styles.deviceLabel}>{tracker.label}</Text>
              </View>
            </View>
            {!editing && (
              <TouchableOpacity
                onPress={() => setEditing(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Editar dados do idoso"
              >
                <IconSymbol name="pencil" size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          {editing ? <EditElderForm elder={elder} onDone={() => setEditing(false)} /> : null}
        </SectionCard>

        {/* ── Personal details ── */}
        <SectionTitle title="Informações pessoais" />
        <SectionCard>
          <DetailRow label="Data de nascimento" value={isoToBr(elder.birthDate)} />
          <DetailRow label="Estágio do diagnóstico" value={LABELS_PT.diagnosisStage[elder.diagnosisStage]} />
          <DetailRow
            label="Medicações cadastradas"
            value={activeMeds === undefined ? '—' : `${activeMeds} ${activeMeds === 1 ? 'medicação' : 'medicações'}`}
            last
          />
        </SectionCard>

        {/* ── Elder's phone ── */}
        <SectionTitle title="Celular do idoso" />
        <SectionCard>
          <Text style={extra.explain}>
            {elder.phonePaired
              ? `O celular de ${name} está pareado e recebe os lembretes das rotinas.`
              : `Instale o app no celular de ${name} e entre com um código gerado aqui.`}
          </Text>
          {elder.phonePaired ? (
            <View style={extra.buttonRow}>
              <Button title="Desparear" variant="secondary" onPress={() => void handleUnpair()} loading={unpair.isPending} style={{ flex: 1 }} />
              <Button title="Novo código" onPress={() => router.push('/(caregiver)/pair-elder')} style={{ flex: 1 }} />
            </View>
          ) : (
            <Button title="Parear celular" onPress={() => router.push('/(caregiver)/pair-elder')} />
          )}
        </SectionCard>

        {/* ── About, for Aurélia ── */}
        <SectionTitle title={`Sobre ${name}`} />
        <SectionCard>
          <AboutSection elder={elder} />
        </SectionCard>

        {/* ── Caregivers ── */}
        <SectionTitle title="Cuidadores" />
        <SectionCard>
          <CaregiversSection elder={elder} />
        </SectionCard>

        {/* ── Safe zone & tracker ── */}
        <SectionTitle title="Localização" />
        <SectionCard>
          <NavRow title="Ver no mapa" value="Ao vivo" onPress={() => router.push('/(caregiver)/location')} />
          <View style={styles.contactDivider} />
          <NavRow
            title="Zona segura"
            value={elder.safeZone ? `Raio de ${elder.safeZone.radiusM} m` : 'Não definida'}
            onPress={() => router.push('/(caregiver)/safe-zone')}
          />
          <View style={styles.contactDivider} />
          <NavRow
            title="Rastreador"
            value={
              detail.data
                ? detail.data.devices.length === 0
                  ? 'Nenhum cadastrado'
                  : `${detail.data.devices.length} cadastrado${detail.data.devices.length > 1 ? 's' : ''}`
                : '…'
            }
            onPress={() => router.push('/(caregiver)/tracker')}
          />
        </SectionCard>

        {/* ── Contacts ── */}
        <SectionTitle title="Contatos" />
        <SectionCard>
          {contacts.isPending ? (
            <LoadingState />
          ) : contacts.isError ? (
            <ErrorState message={friendlyError(contacts.error)} onRetry={() => void contacts.refetch()} />
          ) : (
            <>
              {items.length === 0 && !showAddForm ? (
                <Text style={extra.explain}>Nenhum contato ainda. Adicione quem deve ser chamado numa emergência.</Text>
              ) : null}
              {items.map((c, i) => (
                <React.Fragment key={c.id}>
                  <ContactRow
                    contact={c}
                    busy={patchContact.isPending}
                    onToggleEmergency={handleToggleEmergency}
                    onCall={handleCall}
                    onDelete={(contact) => void handleRemoveContact(contact)}
                  />
                  {i < items.length - 1 && <View style={styles.contactDivider} />}
                </React.Fragment>
              ))}

              {/* Inline add form */}
              {showAddForm ? (
                <AddContactForm elderId={elder.id} nextPriority={nextPriority} onDone={() => setShowAddForm(false)} />
              ) : (
                <TouchableOpacity
                  style={styles.addContactBtn}
                  onPress={() => setShowAddForm(true)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <IconSymbol name="plus.circle.fill" size={18} color={Colors.primary} />
                  <Text style={styles.addContactBtnText}>Adicionar contato</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </SectionCard>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const extra = StyleSheet.create({
  editForm: { gap: Spacing.md, marginTop: Spacing.md },
  chipsLabel: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: Colors.textPrimary },
  chips: { flexDirection: 'row', gap: Spacing.sm },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.white,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  chipTextActive: { color: Colors.primaryText, fontWeight: Typography.weight.semibold },
  explain: { fontSize: Typography.size.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  buttonRow: { flexDirection: 'row', gap: Spacing.sm },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  navTitle: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold, color: Colors.textPrimary },
  navValue: { fontSize: Typography.size.sm, color: Colors.textSecondary, marginTop: 2 },
  leaveText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: Colors.dangerText },
  aboutInput: {
    minHeight: 160,
    borderWidth: 1.5,
    borderColor: Colors.borderMid,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontSize: Typography.size.xs, color: Colors.textMuted },
  aboutText: { fontSize: Typography.size.base, color: Colors.textPrimary, lineHeight: 22 },
  editLink: { marginTop: Spacing.sm, fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: Colors.primary },
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
