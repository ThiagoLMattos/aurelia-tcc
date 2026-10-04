/**
 * Aurélia — Routine builder
 * Unified form to create any task type (medication, meal, activity, custom).
 * Type selector reveals/hides conditional fields.
 * Live preview card updates as fields change.
 * Time picker: inline stepper (production → native DateTimePicker).
 */

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

import { useApp } from '@/context/AppContext';
import { Task, TaskType } from '@/data/mock';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';

// ─── Types ────────────────────────────────────────────────────────────────────

type MedForm = 'Comprimido' | 'Líquido' | 'Injeção' | 'Outro';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: {
  key: TaskType;
  label: string;
  icon: IconSymbolName;
  defaultName: string;
}[] = [
  { key: 'medication', label: 'Medicação',    icon: 'pills.fill',   defaultName: 'Medicação da manhã' },
  { key: 'meal',       label: 'Refeição',     icon: 'fork.knife',   defaultName: 'Café da manhã' },
  { key: 'activity',   label: 'Atividade',    icon: 'figure.walk',  defaultName: 'Caminhada leve' },
  { key: 'custom',     label: 'Personalizada',icon: 'star.fill',    defaultName: 'Tarefa' },
];

const MED_FORMS: MedForm[] = ['Comprimido', 'Líquido', 'Injeção', 'Outro'];

// Days: Dom Seg Ter Qua Qui Sex Sáb (index 0–6)
const DAY_PILLS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const DAY_LABELS_FULL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const PRESETS: { key: 'once' | 'everyday' | 'weekdays' | 'custom'; label: string; days: number[] }[] = [
  { key: 'once',     label: 'Sem repetição', days: [] },
  { key: 'everyday', label: 'Todos os dias', days: [0, 1, 2, 3, 4, 5, 6] },
  { key: 'weekdays', label: 'Dias úteis',    days: [1, 2, 3, 4, 5] },
  { key: 'custom',   label: 'Personalizado', days: [] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function padTwo(n: number): string {
  return n.toString().padStart(2, '0');
}

// Sentinel to distinguish "once" (no repeat, intentional) from "custom with no days yet"
const ONCE_SENTINEL = '__once__';

function repeatSummary(days: number[], once?: boolean): string {
  if (once) return 'Sem repetição — apenas hoje';
  if (days.length === 7) return 'Todos os dias';
  const sorted = [...days].sort((a, b) => a - b);
  if (JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])) return 'Dias úteis';
  if (days.length === 0) return 'Nenhum dia selecionado';
  return sorted.map((d) => DAY_LABELS_FULL[d]).join(', ');
}

function activePreset(days: number[], once: boolean): 'once' | 'everyday' | 'weekdays' | 'custom' {
  if (once) return 'once';
  const s = JSON.stringify([...days].sort((a, b) => a - b));
  if (s === JSON.stringify([0, 1, 2, 3, 4, 5, 6])) return 'everyday';
  if (s === JSON.stringify([1, 2, 3, 4, 5])) return 'weekdays';
  return 'custom';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Section wrapper with label
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

// Toggle switch
function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.8} style={[styles.switch, value && styles.switchOn]}>
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
      <Toggle value={value} onToggle={onToggle} />
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
  isOnce,
}: {
  type: TaskType;
  name: string;
  dosage: string;
  form: string;
  hour: number;
  minute: number;
  days: number[];
  isOnce: boolean;
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
          <Text style={styles.previewChipText}>{repeatSummary(days, isOnce)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RoutineBuilderScreen() {
  const { tasks, addTask, updateTask } = useApp();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  // Editing mode — find the existing task
  const existingTask = id ? tasks.find((t) => t.id === id) ?? null : null;
  const isEditing = existingTask !== null;

  // ── Helpers to parse stored form value ────────────────────────────────────
  // If form is one of the 4 known values, use it directly.
  // Otherwise it's a custom 'Outro' description — set form='Outro' + populate customFormDesc.
  const KNOWN_FORMS: MedForm[] = ['Comprimido', 'Líquido', 'Injeção', 'Outro'];
  function parseStoredForm(stored?: string): { form: MedForm; customFormDesc: string } {
    if (!stored) return { form: 'Comprimido', customFormDesc: '' };
    if (KNOWN_FORMS.includes(stored as MedForm)) return { form: stored as MedForm, customFormDesc: '' };
    return { form: 'Outro', customFormDesc: stored };
  }

  const parsedForm = parseStoredForm(existingTask?.form);

  // ── Form state — initialised from existing task when editing ───────────────
  const [type, setType] = useState<TaskType>(existingTask?.type ?? 'medication');
  const [name, setName] = useState(existingTask?.name ?? '');
  const [dosage, setDosage] = useState(existingTask?.dosage ?? '');
  const [form, setForm] = useState<MedForm>(parsedForm.form);
  const [customFormDesc, setCustomFormDesc] = useState(parsedForm.customFormDesc);
  const [note, setNote] = useState(existingTask?.description ?? '');
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [hour, setHour] = useState(() => {
    if (existingTask?.time) return parseInt(existingTask.time.split(':')[0], 10);
    return 8;
  });
  const [minute, setMinute] = useState(() => {
    if (existingTask?.time) return parseInt(existingTask.time.split(':')[1], 10);
    return 0;
  });
  // isOnce: true when "Sem repetição" is selected — repeatDays stays [] and day pills are hidden
  const [isOnce, setIsOnce] = useState<boolean>(
    existingTask ? existingTask.repeatDays.length === 0 : false,
  );
  const [days, setDays] = useState<number[]>(
    existingTask ? existingTask.repeatDays : [0, 1, 2, 3, 4, 5, 6],
  );
  const [notifyAurelia, setNotifyAurelia] = useState(existingTask?.notifyAurelia ?? true);
  const [alertIfMissed, setAlertIfMissed] = useState(existingTask?.alertIfMissed ?? true);

  // ── Type selection ─────────────────────────────────────────────────────────
  const handleTypeSelect = useCallback((t: TaskType) => {
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
    if (preset.key === 'once') {
      setIsOnce(true);
      setDays([]);
      return;
    }
    setIsOnce(false);
    if (preset.key === 'custom') return; // let user pick days manually
    setDays(preset.days);
  }, []);

  const toggleDay = useCallback((dayIndex: number) => {
    setIsOnce(false); // switching to custom days exits "once" mode
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
    const finalName = name.trim() || cfg.defaultName;
    const timeStr = `${padTwo(hour)}:${padTwo(minute)}`;

    const taskBase: Omit<Task, 'id' | 'status'> = {
      type,
      name: finalName,
      time: timeStr,
      description:
        type === 'medication' && dosage
          ? `${dosage}${resolvedForm ? ` · ${resolvedForm}` : ''}`
          : note || cfg.label,
      repeatDays: days,
      notifyAurelia,
      alertIfMissed,
      ...(type === 'medication' ? { dosage, form: resolvedForm } : {}),
    };

    if (isEditing && id) {
      updateTask(id, taskBase);
    } else {
      addTask(taskBase);
    }
    router.back();
  }, [type, name, dosage, resolvedForm, note, hour, minute, days, notifyAurelia, alertIfMissed, isEditing, id, addTask, updateTask, router]);

  const currentPreset = activePreset(days, isOnce);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                >
                  <IconSymbol
                    name={opt.icon}
                    size={22}
                    color={type === opt.key ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.typeCardLabel, type === opt.key && styles.typeCardLabelSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* ── Name ──────────────────────────────────────────────────────── */}
          <Section title="Nome">
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={TYPE_OPTIONS.find((o) => o.key === type)!.defaultName}
              placeholderTextColor={Colors.textMuted}
              returnKeyType="done"
            />
          </Section>

          {/* ── Medication-only fields ────────────────────────────────────── */}
          {type === 'medication' && (
            <Section title="Dados do medicamento">
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
                      />
                    )}
                  </View>
                </View>
              </View>
            </Section>
          )}

          {/* ── Custom-task-only fields ───────────────────────────────────── */}
          {type === 'custom' && (
            <Section title="Detalhes (opcional)">
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={note}
                onChangeText={setNote}
                placeholder="Observações sobre a tarefa..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={[styles.toggleRow, { marginTop: Spacing.sm }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Requer confirmação</Text>
                  <Text style={styles.toggleSub}>Maria deverá confirmar quando concluir</Text>
                </View>
                <Toggle value={requiresConfirmation} onToggle={() => setRequiresConfirmation((v) => !v)} />
              </View>
            </Section>
          )}

          {/* ── Time picker (stepper) ─────────────────────────────────────── */}
          <Section title="Horário">
            <View style={styles.timePicker}>
              {/* Hour column */}
              <View style={styles.timeColumn}>
                <TouchableOpacity onPress={incrementHour} style={styles.timeArrow} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <IconSymbol name="chevron.left" size={18} color={Colors.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.timeValue}>{padTwo(hour)}</Text>
                <TouchableOpacity onPress={decrementHour} style={styles.timeArrow} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <IconSymbol name="chevron.right" size={18} color={Colors.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.timeUnit}>hora</Text>
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              {/* Minute column */}
              <View style={styles.timeColumn}>
                <TouchableOpacity onPress={incrementMinute} style={styles.timeArrow} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <IconSymbol name="chevron.left" size={18} color={Colors.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.timeValue}>{padTwo(minute)}</Text>
                <TouchableOpacity onPress={decrementMinute} style={styles.timeArrow} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <IconSymbol name="chevron.right" size={18} color={Colors.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.timeUnit}>min</Text>
              </View>
            </View>
          </Section>

          {/* ── Repeat ────────────────────────────────────────────────────── */}
          <Section title="Repetição">
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

            {/* Day pill row — hidden when "Sem repetição" is active */}
            {!isOnce && (
            <View style={styles.dayRow}>
              {DAY_PILLS.map((label, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.dayPill, days.includes(index) && styles.dayPillActive]}
                  onPress={() => toggleDay(index)}
                >
                  <Text style={[styles.dayPillText, days.includes(index) && styles.dayPillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            )}
          </Section>

          {/* ── Reminder toggles ──────────────────────────────────────────── */}
          <Section title="Lembretes">
            <View style={styles.toggleCard}>
              <ToggleRow
                title="Notificar Aurélia"
                subtitle="Aurélia lembrará Maria proativamente"
                value={notifyAurelia}
                onToggle={() => setNotifyAurelia((v) => !v)}
              />
            </View>
            <View style={[styles.toggleCard, { marginTop: Spacing.sm }]}>
              <ToggleRow
                title="Alertar se perdida"
                subtitle="Você receberá uma notificação se não confirmada"
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
              isOnce={isOnce}
            />
          </Section>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnSave} onPress={handleSave} activeOpacity={0.85}>
          <IconSymbol name="checkmark" size={16} color={Colors.white} />
          <Text style={styles.btnSaveText}>{isEditing ? 'Salvar alterações' : 'Salvar rotina'}</Text>
        </TouchableOpacity>
      </View>
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
