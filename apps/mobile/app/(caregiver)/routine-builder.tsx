/**
 * Aurélia — Routine builder
 * One form for every routine type (medication, meal, activity, custom), validated with the shared
 * `CreateRoutineBody` schema. The type reveals the medication fields; a live preview updates as
 * the fields change. Time picker: inline stepper (production → native DateTimePicker).
 */

import { CreateRoutineBodySchema, LABELS_PT, type PatchRoutineBody, type Routine, type RoutineType } from '@aurelia/shared';
import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ErrorState, FormError, LoadingState } from '@/components';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { friendlyError } from '@/lib/errors';
import { validateForm } from '@/lib/forms';
import { firstName } from '@/lib/format';
import { useCreateRoutine, useCurrentElder, usePatchRoutine, useRoutines } from '@/queries';
import { Colors, Radius, Spacing, Typography } from '@/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type MedForm = 'Comprimido' | 'Líquido' | 'Injeção' | 'Outro';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: {
  key: RoutineType;
  icon: IconSymbolName;
  defaultName: string;
}[] = [
  { key: 'medication', icon: 'pills.fill',  defaultName: 'Medicação da manhã' },
  { key: 'meal',       icon: 'fork.knife',  defaultName: 'Café da manhã' },
  { key: 'activity',   icon: 'figure.walk', defaultName: 'Caminhada leve' },
  { key: 'custom',     icon: 'star.fill',   defaultName: 'Tarefa' },
];

const MED_FORMS: MedForm[] = ['Comprimido', 'Líquido', 'Injeção', 'Outro'];

// Days: Dom Seg Ter Qua Qui Sex Sáb (index 0–6)
const DAY_PILLS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const PRESETS: { key: 'everyday' | 'weekdays' | 'custom'; label: string; days: number[] }[] = [
  { key: 'everyday', label: 'Todos os dias', days: [0, 1, 2, 3, 4, 5, 6] },
  { key: 'weekdays', label: 'Dias úteis',    days: [1, 2, 3, 4, 5] },
  { key: 'custom',   label: 'Personalizado', days: [] },
];

/** What each field says when the shared schema rejects it (the schema's own text is not always pt-BR). */
const FIELD_MESSAGES: Record<string, string> = {
  name: 'Dê um nome à rotina (até 120 caracteres).',
  time: 'Escolha um horário válido.',
  weekdays: 'Escolha ao menos um dia.',
  medication: 'Informe a dose e a forma do medicamento.',
  description: 'As observações podem ter até 500 caracteres.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function padTwo(n: number): string {
  return n.toString().padStart(2, '0');
}

function repeatSummary(days: number[]): string {
  if (days.length === 7) return 'Todos os dias';
  const sorted = [...days].sort((a, b) => a - b);
  if (JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])) return 'Dias úteis';
  if (days.length === 0) return 'Nenhum dia selecionado';
  return sorted.map((d) => LABELS_PT.weekdayShort[d]).join(', ');
}

function activePreset(days: number[]): 'everyday' | 'weekdays' | 'custom' {
  const s = JSON.stringify([...days].sort((a, b) => a - b));
  if (s === JSON.stringify([0, 1, 2, 3, 4, 5, 6])) return 'everyday';
  if (s === JSON.stringify([1, 2, 3, 4, 5])) return 'weekdays';
  return 'custom';
}

/** A stored form is one of the four known values, or the free text typed under "Outro". */
function parseStoredForm(stored?: string): { form: MedForm; customFormDesc: string } {
  if (!stored) return { form: 'Comprimido', customFormDesc: '' };
  if (MED_FORMS.includes(stored as MedForm)) return { form: stored as MedForm, customFormDesc: '' };
  return { form: 'Outro', customFormDesc: stored };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Section wrapper with label
function Section({ title, error, children }: { title: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
      {error ? <Text style={extra.fieldError}>{error}</Text> : null}
    </View>
  );
}

// Toggle switch
function Toggle({ value, onToggle, label }: { value: boolean; onToggle: () => void; label: string }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.8}
      style={[styles.switch, value && styles.switchOn]}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.switchKnob, value && styles.switchKnobOn]} />
    </TouchableOpacity>
  );
}

// Toggle row (label + optional subtitle + toggle)
function ToggleRow({
  title,
  subtitle,
  value,
  onToggle,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {subtitle ? <Text style={styles.toggleSub}>{subtitle}</Text> : null}
      </View>
      <Toggle value={value} onToggle={onToggle} label={title} />
    </View>
  );
}

// Live preview card (lavender)
function PreviewCard({
  type,
  name,
  dosage,
  form,
  hour,
  minute,
  days,
}: {
  type: RoutineType;
  name: string;
  dosage: string;
  form: string;
  hour: number;
  minute: number;
  days: number[];
}) {
  const cfg = TYPE_OPTIONS.find((t) => t.key === type)!;
  const timeStr = `${padTwo(hour)}:${padTwo(minute)}`;
  const displayName = name.trim() || cfg.defaultName;

  return (
    <View style={styles.previewCard}>
      <View style={styles.previewHeader}>
        <IconSymbol name={cfg.icon} size={14} color={Colors.aureliaText} />
        <Text style={styles.previewLabel}>Pré-visualização</Text>
      </View>
      <Text style={styles.previewName}>{displayName}</Text>
      {type === 'medication' && dosage ? (
        <Text style={styles.previewSub}>{dosage}{form ? ` · ${form}` : ''}</Text>
      ) : null}
      <View style={styles.previewMeta}>
        <View style={styles.previewChip}>
          <IconSymbol name="clock.fill" size={10} color={Colors.aureliaText} />
          <Text style={styles.previewChipText}>{timeStr}</Text>
        </View>
        <View style={styles.previewChip}>
          <Text style={styles.previewChipText}>{repeatSummary(days)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function RoutineForm({ existing }: { existing: Routine | null }) {
  const elder = useCurrentElder();
  const router = useRouter();
  const create = useCreateRoutine(elder.id);
  const patch = usePatchRoutine(elder.id);
  const isEditing = existing !== null;
  const saving = create.isPending || patch.isPending;

  const parsedForm = parseStoredForm(existing?.medication?.form);

  // ── Form state — initialised from the existing routine when editing ────────
  const [type, setType] = useState<RoutineType>(existing?.type ?? 'medication');
  const [name, setName] = useState(existing?.name ?? '');
  const [dosage, setDosage] = useState(existing?.medication?.dosage ?? '');
  const [form, setForm] = useState<MedForm>(parsedForm.form);
  const [customFormDesc, setCustomFormDesc] = useState(parsedForm.customFormDesc);
  const [note, setNote] = useState(existing?.description ?? '');
  const [hour, setHour] = useState(() => (existing ? Number(existing.time.slice(0, 2)) : 8));
  const [minute, setMinute] = useState(() => (existing ? Number(existing.time.slice(3, 5)) : 0));
  const [days, setDays] = useState<number[]>(existing?.weekdays ?? [0, 1, 2, 3, 4, 5, 6]);
  const [remindElder, setRemindElder] = useState(existing?.remindElder ?? true);
  const [alertIfMissed, setAlertIfMissed] = useState(existing?.alertIfMissed ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Type selection ─────────────────────────────────────────────────────────
  const handleTypeSelect = useCallback((t: RoutineType) => {
    setType(t);
    // Pre-fill name with default only if creating new (not editing)
    if (!isEditing) {
      const cfg = TYPE_OPTIONS.find((o) => o.key === t)!;
      setName((prev) => {
        const isDefault = TYPE_OPTIONS.some((o) => o.defaultName === prev);
        return prev === '' || isDefault ? cfg.defaultName : prev;
      });
    }
  }, [isEditing]);

  // ── Time stepper ────────────────────────────────────────────────────────────
  const incrementHour   = () => setHour((h) => (h + 1) % 24);
  const decrementHour   = () => setHour((h) => (h + 23) % 24);
  const incrementMinute = () => setMinute((m) => (m + 5) % 60);
  const decrementMinute = () => setMinute((m) => (m - 5 + 60) % 60);

  // ── Day toggling ────────────────────────────────────────────────────────────
  const handlePreset = useCallback((preset: typeof PRESETS[number]) => {
    if (preset.key === 'custom') return; // let user pick days manually
    setDays(preset.days);
  }, []);

  const toggleDay = useCallback((dayIndex: number) => {
    setDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex],
    );
  }, []);

  // ── Resolved form value ────────────────────────────────────────────────────
  // When 'Outro' is selected and customFormDesc has text, save the custom description.
  const resolvedForm = form === 'Outro' && customFormDesc.trim()
    ? customFormDesc.trim()
    : form;

  // ── Save / Update ──────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const cfg = TYPE_OPTIONS.find((o) => o.key === type)!;
    const values = {
      type,
      name: name.trim() || cfg.defaultName,
      description: note.trim(),
      time: `${padTwo(hour)}:${padTwo(minute)}`,
      weekdays: [...days].sort((a, b) => a - b),
      ...(type === 'medication' ? { medication: { dosage: dosage.trim(), form: resolvedForm } } : {}),
      remindElder,
      alertIfMissed,
    };

    const result = validateForm(CreateRoutineBodySchema, values, FIELD_MESSAGES);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitError(null);

    const handlers = {
      onSuccess: () => router.back(),
      onError: (error: unknown) => setSubmitError(friendlyError(error)),
    };
    if (existing) {
      const body: PatchRoutineBody = result.data;
      patch.mutate({ routineId: existing.id, body }, handlers);
    } else {
      create.mutate(result.data, handlers);
    }
  }, [type, name, note, hour, minute, days, dosage, resolvedForm, remindElder, alertIfMissed, existing, create, patch, router]);

  const currentPreset = activePreset(days);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Voltar">
          <IconSymbol name="chevron.left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Editar rotina' : 'Nova rotina'}</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Type selector ─────────────────────────────────────────────── */}
          <Section title="Tipo">
            <View style={styles.typeGrid}>
              {TYPE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.typeCard, type === opt.key && styles.typeCardSelected]}
                  onPress={() => handleTypeSelect(opt.key)}
                  activeOpacity={0.75}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: type === opt.key }}
                >
                  <IconSymbol
                    name={opt.icon}
                    size={22}
                    color={type === opt.key ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.typeCardLabel, type === opt.key && styles.typeCardLabelSelected]}>
                    {LABELS_PT.routineType[opt.key]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* ── Name ──────────────────────────────────────────────────────── */}
          <Section title="Nome" error={errors.name}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={TYPE_OPTIONS.find((o) => o.key === type)!.defaultName}
              placeholderTextColor={Colors.textMuted}
              returnKeyType="done"
              accessibilityLabel="Nome da rotina"
            />
          </Section>

          {/* ── Medication-only fields ────────────────────────────────────── */}
          {type === 'medication' && (
            <Section title="Dados do medicamento" error={errors.medication}>
              <View style={styles.medBox}>
                <View style={styles.medRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Dosagem</Text>
                    <TextInput
                      style={styles.inputSm}
                      value={dosage}
                      onChangeText={setDosage}
                      placeholder="ex: 10mg"
                      placeholderTextColor={Colors.textMuted}
                      returnKeyType="done"
                      accessibilityLabel="Dosagem"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Forma</Text>
                    <View style={styles.formPillRow}>
                      {MED_FORMS.map((f) => (
                        <TouchableOpacity
                          key={f}
                          style={[styles.formPill, form === f && styles.formPillSelected]}
                          onPress={() => setForm(f)}
                        >
                          <Text style={[styles.formPillText, form === f && styles.formPillTextSelected]}>
                            {f}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {/* Custom description when "Outro" is selected */}
                    {form === 'Outro' && (
                      <TextInput
                        style={[styles.inputSm, { marginTop: 6 }]}
                        value={customFormDesc}
                        onChangeText={setCustomFormDesc}
                        placeholder="Descreva a forma (ex: Adesivo)"
                        placeholderTextColor={Colors.textMuted}
                        returnKeyType="done"
                        autoFocus
                        accessibilityLabel="Descrição da forma"
                      />
                    )}
                  </View>
                </View>
              </View>
            </Section>
          )}

          {/* ── Notes ─────────────────────────────────────────────────────── */}
          <Section title="Observações (opcional)" error={errors.description}>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={note}
              onChangeText={setNote}
              placeholder="Algo que ajude a lembrar desta rotina..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={500}
              accessibilityLabel="Observações"
            />
          </Section>

          {/* ── Time picker (stepper) ─────────────────────────────────────── */}
          <Section title="Horário" error={errors.time}>
            <View style={styles.timePicker}>
              {/* Hour column */}
              <View style={styles.timeColumn}>
                <TouchableOpacity onPress={incrementHour} style={styles.timeArrow} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }} accessibilityLabel="Hora mais uma">
                  <IconSymbol name="chevron.left" size={18} color={Colors.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.timeValue}>{padTwo(hour)}</Text>
                <TouchableOpacity onPress={decrementHour} style={styles.timeArrow} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }} accessibilityLabel="Hora menos uma">
                  <IconSymbol name="chevron.right" size={18} color={Colors.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.timeUnit}>hora</Text>
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              {/* Minute column */}
              <View style={styles.timeColumn}>
                <TouchableOpacity onPress={incrementMinute} style={styles.timeArrow} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }} accessibilityLabel="Minutos mais cinco">
                  <IconSymbol name="chevron.left" size={18} color={Colors.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.timeValue}>{padTwo(minute)}</Text>
                <TouchableOpacity onPress={decrementMinute} style={styles.timeArrow} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }} accessibilityLabel="Minutos menos cinco">
                  <IconSymbol name="chevron.right" size={18} color={Colors.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.timeUnit}>min</Text>
              </View>
            </View>
          </Section>

          {/* ── Repeat ────────────────────────────────────────────────────── */}
          <Section title="Repetição" error={errors.weekdays}>
            {/* Preset chips */}
            <View style={styles.presetRow}>
              {PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.presetChip, currentPreset === p.key && styles.presetChipActive]}
                  onPress={() => handlePreset(p)}
                  disabled={p.key === 'custom' && currentPreset !== 'custom'}
                >
                  <Text style={[styles.presetChipText, currentPreset === p.key && styles.presetChipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Day pills */}
            <View style={styles.dayRow}>
              {DAY_PILLS.map((label, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.dayPill, days.includes(index) && styles.dayPillActive]}
                  onPress={() => toggleDay(index)}
                  accessibilityLabel={LABELS_PT.weekdayLong[index]}
                  accessibilityState={{ selected: days.includes(index) }}
                >
                  <Text style={[styles.dayPillText, days.includes(index) && styles.dayPillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* ── Reminder toggles ──────────────────────────────────────────── */}
          <Section title="Lembretes">
            <View style={styles.toggleCard}>
              <ToggleRow
                title="Lembrar o idoso"
                subtitle={`${firstName(elder.name)} recebe um lembrete no celular dele(a)`}
                value={remindElder}
                onToggle={() => setRemindElder((v) => !v)}
              />
            </View>
            <View style={[styles.toggleCard, { marginTop: Spacing.sm }]}>
              <ToggleRow
                title="Alertar se perdida"
                subtitle="Você recebe uma notificação se não for confirmada"
                value={alertIfMissed}
                onToggle={() => setAlertIfMissed((v) => !v)}
              />
            </View>
          </Section>

          {/* ── Live preview ──────────────────────────────────────────────── */}
          <Section title="Como ficará">
            <PreviewCard
              type={type}
              name={name}
              dosage={dosage}
              form={resolvedForm}
              hour={hour}
              minute={minute}
              days={days}
            />
          </Section>

          <FormError message={submitError} />

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btnSave, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <IconSymbol name="checkmark" size={16} color={Colors.white} />
          <Text style={styles.btnSaveText}>{saving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Salvar rotina'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RoutineBuilderScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const elder = useCurrentElder();
  const routines = useRoutines(elder.id);

  if (!id) return <RoutineForm existing={null} />;
  if (routines.isPending) return <LoadingState />;
  if (routines.isError) return <ErrorState message={friendlyError(routines.error)} onRetry={() => void routines.refetch()} />;

  const existing = routines.data.items.find((r) => r.id === id);
  if (!existing) return <ErrorState message="Não encontramos esta rotina. Ela pode ter sido removida." />;
  return <RoutineForm key={existing.id} existing={existing} />;
}

const extra = StyleSheet.create({
  fieldError: { fontSize: Typography.size.sm, color: Colors.dangerText },
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
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },

  // Section
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // Type selector grid
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeCard: {
    width: '47.5%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.borderMid,
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
  },
  typeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  typeCardLabel: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
  typeCardLabelSelected: {
    color: Colors.primaryText,
  },

  // Inputs
  input: {
    backgroundColor: Colors.white,
    borderWidth: 0.5,
    borderColor: Colors.borderMid,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },
  inputSm: {
    backgroundColor: Colors.white,
    borderWidth: 0.5,
    borderColor: Colors.borderMid,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: Typography.size.sm,
    color: Colors.textPrimary,
  },
  inputMultiline: {
    height: 80,
    paddingTop: Spacing.sm,
  },

  // Medication box
  medBox: {
    backgroundColor: Colors.progressBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  medRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  miniLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: Typography.weight.medium,
  },
  formPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  formPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.white,
  },
  formPillSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  formPillText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.medium,
  },
  formPillTextSelected: {
    color: Colors.white,
    fontWeight: Typography.weight.semibold,
  },

  // Toggle row
  toggleCard: {
    backgroundColor: Colors.white,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toggleTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  toggleSub: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Switch
  switch: {
    width: 36,
    height: 20,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderMid,
    flexShrink: 0,
    justifyContent: 'center',
  },
  switchOn: {
    backgroundColor: Colors.primary,
  },
  switchKnob: {
    width: 15,
    height: 15,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    marginLeft: 2.5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  switchKnobOn: {
    marginLeft: 18.5,
  },

  // Time picker
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
  },
  timeColumn: {
    alignItems: 'center',
    gap: 4,
  },
  timeArrow: {
    padding: 4,
  },
  timeValue: {
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    width: 60,
    textAlign: 'center',
  },
  timeUnit: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  timeSeparator: {
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xl,
  },

  // Repeat
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.white,
  },
  presetChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  presetChipText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.medium,
  },
  presetChipTextActive: {
    color: Colors.white,
    fontWeight: Typography.weight.semibold,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayPill: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  dayPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayPillText: {
    fontSize: 11,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
  dayPillTextActive: {
    color: Colors.white,
  },

  // Live preview card
  previewCard: {
    backgroundColor: Colors.white,
    borderWidth: 0.5,
    borderColor: Colors.aureliaBorder,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  previewLabel: {
    fontSize: Typography.size.xs,
    color: Colors.aureliaText,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewName: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  previewSub: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  previewMeta: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.aureliaBg,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  previewChipText: {
    fontSize: Typography.size.xs,
    color: Colors.aureliaText,
    fontWeight: Typography.weight.medium,
  },

  // Footer
  footer: {
    backgroundColor: Colors.white,
    borderTopWidth: 0.5,
    borderTopColor: Colors.borderLight,
    padding: Spacing.md,
  },
  btnSave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
  },
  btnSaveText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.white,
  },
});
