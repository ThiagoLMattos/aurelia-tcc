/**
 * Aurélia — Mock data
 * Realistic seed data used for all screens until a real backend is connected.
 * Replace individual slices with API calls as each backend endpoint is ready.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type TaskType = 'medication' | 'meal' | 'activity' | 'custom';
export type TaskStatus = 'done' | 'pending' | 'missed' | 'now';

export type Task = {
  id: string;
  type: TaskType;
  name: string;
  time: string; // 'HH:MM'
  description: string;
  status: TaskStatus;
  // Medication-specific
  dosage?: string;
  form?: string; // 'Comprimido' | 'Líquido' | 'Injeção' | free-text when 'Outro' is selected
  // Repeat
  repeatDays: number[]; // 0=Sun … 6=Sat
  // Reminder flags
  notifyAurelia: boolean;
  alertIfMissed: boolean;
};

export type Contact = {
  id: string;
  name: string;
  initials: string;
  role: string;
  phone: string;
  escalation: boolean;
};

export type HistoryEvent = {
  id: string;
  type: 'done' | 'missed' | 'breach';
  title: string;
  time: string; // 'HH:MM'
  summary: string;
  // Extra detail shown on expand
  scheduledTime?: string;
  confirmedTime?: string;
  // Geo-fence specific
  detectedTime?: string;
  resolvedTime?: string;
  distanceOutside?: string;
  duration?: string;
  occurrenceNote?: string; // e.g. '2ª ocorrência esta semana'
};

export type DayHistory = {
  date: string; // 'YYYY-MM-DD'
  label: string; // 'Seg', 'Ter' …
  dayNum: number;
  events: HistoryEvent[];
  hasDone: boolean;
  hasMissed: boolean;
  hasBreach: boolean;
};

export type Elder = {
  id: string;
  name: string;
  initials: string;
  age: number;
  diagnosisStage: string;
  dateOfBirth: string;
  activeMedCount: number;
  deviceConnected: boolean;
  safeZoneRadius: number; // metres
  safeZoneLat: number;
  safeZoneLng: number;
};

export type AppSettings = {
  notifyGeofence: boolean;      // always true, locked
  notifyMissedTask: boolean;
  notifyConfirmations: boolean;
  notifyAureliaInsights: boolean;
  missedTaskTimeout: 15 | 30 | 60; // minutes
  escalationMode: 'me-only' | 'me-then-contacts';
  language: string;
};

// ─── Elder ───────────────────────────────────────────────────────────────────

export const MOCK_ELDER: Elder = {
  id: 'elder-1',
  name: 'Maria Gorete',
  initials: 'MG',
  age: 78,
  diagnosisStage: 'Estágio inicial',
  dateOfBirth: '15/03/1947',
  activeMedCount: 3,
  deviceConnected: true,
  safeZoneRadius: 150,
  safeZoneLat: -22.9068,
  safeZoneLng: -43.1729,
};

// ─── Today's tasks ────────────────────────────────────────────────────────────

export const MOCK_TASKS_TODAY: Task[] = [
  {
    id: 'task-1',
    type: 'medication',
    name: 'Medicação da manhã',
    time: '08:00',
    description: 'Donepezil 10mg',
    status: 'done',
    dosage: '10mg',
    form: 'Comprimido',
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    notifyAurelia: true,
    alertIfMissed: true,
  },
  {
    id: 'task-2',
    type: 'meal',
    name: 'Café da manhã',
    time: '08:30',
    description: 'Refeição matinal',
    status: 'done',
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    notifyAurelia: true,
    alertIfMissed: false,
  },
  {
    id: 'task-3',
    type: 'activity',
    name: 'Caminhada leve',
    time: '10:00',
    description: '15 minutos no jardim',
    status: 'done',
    repeatDays: [1, 3, 5],
    notifyAurelia: true,
    alertIfMissed: false,
  },
  {
    id: 'task-4',
    type: 'medication',
    name: 'Medicação da tarde',
    time: '14:00',
    description: 'Memantina 10mg',
    status: 'missed',
    dosage: '10mg',
    form: 'Comprimido',
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    notifyAurelia: true,
    alertIfMissed: true,
  },
  {
    id: 'task-5',
    type: 'medication',
    name: 'Medicação da noite',
    time: '20:00',
    description: 'Donepezil 10mg · próxima',
    status: 'pending',
    dosage: '10mg',
    form: 'Comprimido',
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    notifyAurelia: true,
    alertIfMissed: true,
  },
];

// ─── Contacts ─────────────────────────────────────────────────────────────────

export const MOCK_CONTACTS: Contact[] = [
  {
    id: 'contact-1',
    name: 'Carlos Lameiras',
    initials: 'CL',
    role: 'Filho',
    phone: '+55 19 99999-1111',
    escalation: true,
  },
  {
    id: 'contact-2',
    name: 'Ana Paula',
    initials: 'AP',
    role: 'Filha',
    phone: '+55 19 99999-2222',
    escalation: false,
  },
  {
    id: 'contact-3',
    name: 'Dr. Renato Silva',
    initials: 'RS',
    role: 'Médico',
    phone: '+55 19 99999-3333',
    escalation: true,
  },
];

// ─── Week history ─────────────────────────────────────────────────────────────

export const MOCK_WEEK_HISTORY: DayHistory[] = [
  {
    date: '2026-06-17',
    label: 'Seg',
    dayNum: 17,
    hasDone: true,
    hasMissed: false,
    hasBreach: false,
    events: [
      { id: 'h1-1', type: 'done', title: 'Medicação da manhã', time: '08:03', summary: 'Confirmado às 08:03', scheduledTime: '08:00', confirmedTime: '08:03' },
      { id: 'h1-2', type: 'done', title: 'Café da manhã', time: '08:35', summary: 'Confirmado às 08:35', scheduledTime: '08:30', confirmedTime: '08:35' },
      { id: 'h1-3', type: 'done', title: 'Caminhada leve', time: '10:08', summary: 'Confirmado às 10:08', scheduledTime: '10:00', confirmedTime: '10:08' },
      { id: 'h1-4', type: 'done', title: 'Medicação da tarde', time: '14:02', summary: 'Confirmado às 14:02', scheduledTime: '14:00', confirmedTime: '14:02' },
      { id: 'h1-5', type: 'done', title: 'Medicação da noite', time: '20:01', summary: 'Confirmado às 20:01', scheduledTime: '20:00', confirmedTime: '20:01' },
    ],
  },
  {
    date: '2026-06-18',
    label: 'Ter',
    dayNum: 18,
    hasDone: true,
    hasMissed: true,
    hasBreach: false,
    events: [
      { id: 'h2-1', type: 'done', title: 'Medicação da manhã', time: '08:10', summary: 'Confirmado às 08:10', scheduledTime: '08:00', confirmedTime: '08:10' },
      { id: 'h2-2', type: 'done', title: 'Café da manhã', time: '08:40', summary: 'Confirmado às 08:40', scheduledTime: '08:30', confirmedTime: '08:40' },
      { id: 'h2-3', type: 'missed', title: 'Medicação da tarde', time: '14:00', summary: 'Não confirmada', scheduledTime: '14:00', occurrenceNote: '1ª ocorrência esta semana' },
      { id: 'h2-4', type: 'done', title: 'Medicação da noite', time: '20:05', summary: 'Confirmado às 20:05', scheduledTime: '20:00', confirmedTime: '20:05' },
    ],
  },
  {
    date: '2026-06-19',
    label: 'Qua',
    dayNum: 19,
    hasDone: true,
    hasMissed: false,
    hasBreach: false,
    events: [
      { id: 'h3-1', type: 'done', title: 'Medicação da manhã', time: '08:00', summary: 'Confirmado às 08:00', scheduledTime: '08:00', confirmedTime: '08:00' },
      { id: 'h3-2', type: 'done', title: 'Café da manhã', time: '08:33', summary: 'Confirmado às 08:33', scheduledTime: '08:30', confirmedTime: '08:33' },
      { id: 'h3-3', type: 'done', title: 'Medicação da tarde', time: '14:01', summary: 'Confirmado às 14:01', scheduledTime: '14:00', confirmedTime: '14:01' },
      { id: 'h3-4', type: 'done', title: 'Medicação da noite', time: '20:00', summary: 'Confirmado às 20:00', scheduledTime: '20:00', confirmedTime: '20:00' },
    ],
  },
  {
    date: '2026-06-20',
    label: 'Qui',
    dayNum: 20,
    hasDone: true,
    hasMissed: true,
    hasBreach: true,
    events: [
      { id: 'h4-1', type: 'done', title: 'Medicação da manhã', time: '08:05', summary: 'Confirmado às 08:05', scheduledTime: '08:00', confirmedTime: '08:05' },
      { id: 'h4-2', type: 'breach', title: 'Saída da zona segura', time: '09:42', summary: 'Detectado às 09:42 · resolvido às 10:15', detectedTime: '09:42', resolvedTime: '10:15', distanceOutside: '~80m', duration: '33 min' },
      { id: 'h4-3', type: 'missed', title: 'Caminhada leve', time: '10:00', summary: 'Não confirmada · evento de saída em andamento', scheduledTime: '10:00', occurrenceNote: '1ª ocorrência' },
      { id: 'h4-4', type: 'done', title: 'Medicação da tarde', time: '14:03', summary: 'Confirmado às 14:03', scheduledTime: '14:00', confirmedTime: '14:03' },
      { id: 'h4-5', type: 'done', title: 'Medicação da noite', time: '20:00', summary: 'Confirmado às 20:00', scheduledTime: '20:00', confirmedTime: '20:00' },
    ],
  },
  {
    date: '2026-06-21',
    label: 'Sex',
    dayNum: 21,
    hasDone: true,
    hasMissed: false,
    hasBreach: false,
    events: [
      { id: 'h5-1', type: 'done', title: 'Medicação da manhã', time: '08:02', summary: 'Confirmado às 08:02', scheduledTime: '08:00', confirmedTime: '08:02' },
      { id: 'h5-2', type: 'done', title: 'Café da manhã', time: '08:32', summary: 'Confirmado às 08:32', scheduledTime: '08:30', confirmedTime: '08:32' },
      { id: 'h5-3', type: 'done', title: 'Caminhada leve', time: '10:05', summary: 'Confirmado às 10:05', scheduledTime: '10:00', confirmedTime: '10:05' },
      { id: 'h5-4', type: 'done', title: 'Medicação da tarde', time: '14:00', summary: 'Confirmado às 14:00', scheduledTime: '14:00', confirmedTime: '14:00' },
      { id: 'h5-5', type: 'done', title: 'Medicação da noite', time: '20:04', summary: 'Confirmado às 20:04', scheduledTime: '20:00', confirmedTime: '20:04' },
    ],
  },
  {
    date: '2026-06-22',
    label: 'Sáb',
    dayNum: 22,
    hasDone: true,
    hasMissed: false,
    hasBreach: false,
    events: [
      { id: 'h6-1', type: 'done', title: 'Medicação da manhã', time: '08:15', summary: 'Confirmado às 08:15', scheduledTime: '08:00', confirmedTime: '08:15' },
      { id: 'h6-2', type: 'done', title: 'Café da manhã', time: '08:45', summary: 'Confirmado às 08:45', scheduledTime: '08:30', confirmedTime: '08:45' },
      { id: 'h6-3', type: 'done', title: 'Medicação da tarde', time: '14:10', summary: 'Confirmado às 14:10', scheduledTime: '14:00', confirmedTime: '14:10' },
      { id: 'h6-4', type: 'done', title: 'Medicação da noite', time: '20:02', summary: 'Confirmado às 20:02', scheduledTime: '20:00', confirmedTime: '20:02' },
    ],
  },
  {
    date: '2026-06-23',
    label: 'Dom',
    dayNum: 23,
    hasDone: true,
    hasMissed: true,
    hasBreach: false,
    events: [
      { id: 'h7-1', type: 'done', title: 'Medicação da manhã', time: '08:03', summary: 'Confirmado às 08:03', scheduledTime: '08:00', confirmedTime: '08:03' },
      { id: 'h7-2', type: 'done', title: 'Café da manhã', time: '08:31', summary: 'Confirmado às 08:31', scheduledTime: '08:30', confirmedTime: '08:31' },
      { id: 'h7-3', type: 'done', title: 'Caminhada leve', time: '10:07', summary: 'Confirmado às 10:07', scheduledTime: '10:00', confirmedTime: '10:07' },
      { id: 'h7-4', type: 'missed', title: 'Medicação da tarde', time: '14:00', summary: 'Não confirmada', scheduledTime: '14:00', occurrenceNote: '2ª ocorrência esta semana' },
    ],
  },
];

// ─── Previous week history (10–16 jun 2026) ───────────────────────────────────
// Slightly worse week (4 missed meds, 1 breach) — used for week-over-week comparison in Relatórios.

export const MOCK_PREV_WEEK_HISTORY: DayHistory[] = [
  {
    date: '2026-06-10', label: 'Seg', dayNum: 10,
    hasDone: true, hasMissed: false, hasBreach: false,
    events: [
      { id: 'p1-1', type: 'done',   title: 'Medicação da manhã', time: '08:04', summary: 'Confirmado às 08:04', scheduledTime: '08:00', confirmedTime: '08:04' },
      { id: 'p1-2', type: 'done',   title: 'Café da manhã',      time: '08:34', summary: 'Confirmado às 08:34', scheduledTime: '08:30', confirmedTime: '08:34' },
      { id: 'p1-3', type: 'done',   title: 'Caminhada leve',     time: '10:06', summary: 'Confirmado às 10:06', scheduledTime: '10:00', confirmedTime: '10:06' },
      { id: 'p1-4', type: 'done',   title: 'Medicação da tarde', time: '14:01', summary: 'Confirmado às 14:01', scheduledTime: '14:00', confirmedTime: '14:01' },
      { id: 'p1-5', type: 'done',   title: 'Medicação da noite', time: '20:02', summary: 'Confirmado às 20:02', scheduledTime: '20:00', confirmedTime: '20:02' },
    ],
  },
  {
    date: '2026-06-11', label: 'Ter', dayNum: 11,
    hasDone: true, hasMissed: true, hasBreach: false,
    events: [
      { id: 'p2-1', type: 'done',   title: 'Medicação da manhã', time: '08:07', summary: 'Confirmado às 08:07', scheduledTime: '08:00', confirmedTime: '08:07' },
      { id: 'p2-2', type: 'done',   title: 'Café da manhã',      time: '08:37', summary: 'Confirmado às 08:37', scheduledTime: '08:30', confirmedTime: '08:37' },
      { id: 'p2-3', type: 'done',   title: 'Caminhada leve',     time: '10:09', summary: 'Confirmado às 10:09', scheduledTime: '10:00', confirmedTime: '10:09' },
      { id: 'p2-4', type: 'missed', title: 'Medicação da tarde', time: '14:00', summary: 'Não confirmada',      scheduledTime: '14:00', occurrenceNote: '1ª ocorrência esta semana' },
      { id: 'p2-5', type: 'done',   title: 'Medicação da noite', time: '20:03', summary: 'Confirmado às 20:03', scheduledTime: '20:00', confirmedTime: '20:03' },
    ],
  },
  {
    date: '2026-06-12', label: 'Qua', dayNum: 12,
    hasDone: true, hasMissed: true, hasBreach: false,
    events: [
      { id: 'p3-1', type: 'done',   title: 'Medicação da manhã', time: '08:01', summary: 'Confirmado às 08:01', scheduledTime: '08:00', confirmedTime: '08:01' },
      { id: 'p3-2', type: 'done',   title: 'Café da manhã',      time: '08:31', summary: 'Confirmado às 08:31', scheduledTime: '08:30', confirmedTime: '08:31' },
      { id: 'p3-3', type: 'done',   title: 'Medicação da tarde', time: '14:04', summary: 'Confirmado às 14:04', scheduledTime: '14:00', confirmedTime: '14:04' },
      { id: 'p3-4', type: 'missed', title: 'Medicação da noite', time: '20:00', summary: 'Não confirmada',      scheduledTime: '20:00', occurrenceNote: '1ª vez à noite esta semana' },
    ],
  },
  {
    date: '2026-06-13', label: 'Qui', dayNum: 13,
    hasDone: true, hasMissed: true, hasBreach: true,
    events: [
      { id: 'p4-1', type: 'done',   title: 'Medicação da manhã',  time: '08:05', summary: 'Confirmado às 08:05',                          scheduledTime: '08:00', confirmedTime: '08:05' },
      { id: 'p4-2', type: 'breach', title: 'Saída da zona segura', time: '11:15', summary: 'Detectado às 11:15 · resolvido às 11:52',    detectedTime: '11:15', resolvedTime: '11:52', distanceOutside: '~60m', duration: '37 min' },
      { id: 'p4-3', type: 'missed', title: 'Caminhada leve',       time: '10:00', summary: 'Não confirmada',                               scheduledTime: '10:00' },
      { id: 'p4-4', type: 'missed', title: 'Medicação da tarde',   time: '14:00', summary: 'Não confirmada · evento de saída em andamento', scheduledTime: '14:00', occurrenceNote: '2ª ocorrência esta semana' },
      { id: 'p4-5', type: 'done',   title: 'Medicação da noite',   time: '20:00', summary: 'Confirmado às 20:00',                          scheduledTime: '20:00', confirmedTime: '20:00' },
    ],
  },
  {
    date: '2026-06-14', label: 'Sex', dayNum: 14,
    hasDone: true, hasMissed: true, hasBreach: false,
    events: [
      { id: 'p5-1', type: 'done',   title: 'Medicação da manhã', time: '08:02', summary: 'Confirmado às 08:02', scheduledTime: '08:00', confirmedTime: '08:02' },
      { id: 'p5-2', type: 'done',   title: 'Café da manhã',      time: '08:32', summary: 'Confirmado às 08:32', scheduledTime: '08:30', confirmedTime: '08:32' },
      { id: 'p5-3', type: 'missed', title: 'Medicação da tarde', time: '14:00', summary: 'Não confirmada',      scheduledTime: '14:00', occurrenceNote: '3ª ocorrência esta semana' },
      { id: 'p5-4', type: 'done',   title: 'Medicação da noite', time: '20:01', summary: 'Confirmado às 20:01', scheduledTime: '20:00', confirmedTime: '20:01' },
    ],
  },
  {
    date: '2026-06-15', label: 'Sáb', dayNum: 15,
    hasDone: true, hasMissed: false, hasBreach: false,
    events: [
      { id: 'p6-1', type: 'done', title: 'Medicação da manhã', time: '08:10', summary: 'Confirmado às 08:10', scheduledTime: '08:00', confirmedTime: '08:10' },
      { id: 'p6-2', type: 'done', title: 'Café da manhã',      time: '08:40', summary: 'Confirmado às 08:40', scheduledTime: '08:30', confirmedTime: '08:40' },
      { id: 'p6-3', type: 'done', title: 'Medicação da tarde', time: '14:05', summary: 'Confirmado às 14:05', scheduledTime: '14:00', confirmedTime: '14:05' },
      { id: 'p6-4', type: 'done', title: 'Medicação da noite', time: '20:03', summary: 'Confirmado às 20:03', scheduledTime: '20:00', confirmedTime: '20:03' },
    ],
  },
  {
    date: '2026-06-16', label: 'Dom', dayNum: 16,
    hasDone: true, hasMissed: false, hasBreach: false,
    events: [
      { id: 'p7-1', type: 'done', title: 'Medicação da manhã', time: '08:08', summary: 'Confirmado às 08:08', scheduledTime: '08:00', confirmedTime: '08:08' },
      { id: 'p7-2', type: 'done', title: 'Café da manhã',      time: '08:38', summary: 'Confirmado às 08:38', scheduledTime: '08:30', confirmedTime: '08:38' },
      { id: 'p7-3', type: 'done', title: 'Medicação da tarde', time: '14:02', summary: 'Confirmado às 14:02', scheduledTime: '14:00', confirmedTime: '14:02' },
    ],
  },
];

// ─── Settings ─────────────────────────────────────────────────────────────────

export const MOCK_SETTINGS: AppSettings = {
  notifyGeofence: true,
  notifyMissedTask: true,
  notifyConfirmations: false,
  notifyAureliaInsights: true,
  missedTaskTimeout: 30,
  escalationMode: 'me-only',
  language: 'Português (BR)',
};

// ─── Caregiver account ────────────────────────────────────────────────────────

export const MOCK_CAREGIVER = {
  name: 'Thiago Lameiras',
  initials: 'TL',
  email: 'thiagomlameiras@gmail.com',
  role: 'Cuidador principal',
};
