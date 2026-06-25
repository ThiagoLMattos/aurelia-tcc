/**
 * Aurélia — App Context
 *
 * Central state for the caregiver app. All screens consume from here.
 *
 * Data flow:
 *   - On mount: each slice is loaded via its service (mock or API).
 *   - Mutations: optimistic state update first (instant UI), then service
 *     call for persistence. The service is a no-op in mock mode and makes
 *     an HTTP request in API mode — the component never knows the difference.
 *
 * To connect the real backend: set USE_MOCK = false in config/env.ts.
 * No other file needs to change.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import type { AppSettings, Contact, DayHistory, Elder, Task } from '@/data/mock';
import {
  contactService,
  elderService,
  geofenceService,
  historyService,
  settingsService,
  taskService,
} from '@/services';
import type { Caregiver } from '@/services/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type GeoFenceStatus = 'inside' | 'outside';

export type AppState = {
  elder: Elder;
  tasks: Task[];
  geoFenceStatus: GeoFenceStatus;
  breachTimestamp: Date | null;
  weekHistory: DayHistory[];     // current week — Histórico tab
  weeks: DayHistory[][];         // all weeks oldest→newest — Relatórios
  contacts: Contact[];
  settings: AppSettings;
  caregiver: Caregiver;
};

export type AppActions = {
  markTaskDone: (taskId: string) => void;
  undoTaskDone: (taskId: string) => void;
  addTask: (task: Omit<Task, 'id' | 'status'>) => void;
  updateTask: (taskId: string, patch: Omit<Task, 'id' | 'status'>) => void;
  deleteTask: (taskId: string) => void;
  triggerBreach: () => void;
  resolveBreach: () => void;
  addContact: (contact: Omit<Contact, 'id'>) => void;
  updateContact: (contactId: string, patch: Partial<Contact>) => void;
  removeContact: (contactId: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateElder: (patch: Partial<Elder>) => void;
};

type AppContextValue = AppState & AppActions;

// ─── Empty initial states ─────────────────────────────────────────────────────
// Used before the service resolves. Mock services are near-instant so there's
// no visible flash. API services may show empty lists briefly — add loading
// indicators when connecting the real backend.

const INITIAL_ELDER: Elder = {
  id: '', name: '', initials: '', age: 0,
  diagnosisStage: '', dateOfBirth: '', activeMedCount: 0,
  deviceConnected: false, safeZoneRadius: 100,
  safeZoneLat: 0, safeZoneLng: 0,
};

const INITIAL_SETTINGS: AppSettings = {
  notifyGeofence: true,
  notifyMissedTask: true,
  notifyConfirmations: false,
  notifyAureliaInsights: true,
  missedTaskTimeout: 30,
  escalationMode: 'me-only',
  language: 'Português (BR)',
};

const INITIAL_CAREGIVER: Caregiver = {
  name: '', initials: '', email: '', role: '',
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [elder,           setElder]           = useState<Elder>(INITIAL_ELDER);
  const [tasks,           setTasks]           = useState<Task[]>([]);
  const [geoFenceStatus,  setGeoFenceStatus]  = useState<GeoFenceStatus>('inside');
  const [breachTimestamp, setBreachTimestamp] = useState<Date | null>(null);
  const [weeks,           setWeeks]           = useState<DayHistory[][]>([]);
  const [contacts,        setContacts]        = useState<Contact[]>([]);
  const [settings,        setSettings]        = useState<AppSettings>(INITIAL_SETTINGS);
  const [caregiver,       setCaregiver]       = useState<Caregiver>(INITIAL_CAREGIVER);

  // Current week is always the last element in the weeks array
  const weekHistory: DayHistory[] = weeks.length > 0 ? weeks[weeks.length - 1] : [];

  // ── Initial data load ──────────────────────────────────────────────────────
  // Each service call is independent so a failure in one doesn't block others.

  useEffect(() => {
    taskService.getTodayTasks().then(setTasks).catch(console.error);
    elderService.getElder().then(setElder).catch(console.error);
    contactService.getContacts().then(setContacts).catch(console.error);
    historyService.getWeeks().then(setWeeks).catch(console.error);
    settingsService.getSettings().then(setSettings).catch(console.error);
    settingsService.getCaregiver().then(setCaregiver).catch(console.error);
  }, []);

  // ── Task actions ───────────────────────────────────────────────────────────

  const markTaskDone = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'done' } : t));
    taskService.markDone(taskId).catch(console.error);
  }, []);

  const undoTaskDone = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'pending' } : t));
    taskService.undoMarkDone(taskId).catch(console.error);
  }, []);

  const addTask = useCallback((task: Omit<Task, 'id' | 'status'>) => {
    taskService.create(task)
      .then(newTask =>
        setTasks(prev => [...prev, newTask].sort((a, b) => a.time.localeCompare(b.time)))
      )
      .catch(console.error);
  }, []);

  const updateTask = useCallback((taskId: string, patch: Omit<Task, 'id' | 'status'>) => {
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, ...patch } : t)
          .sort((a, b) => a.time.localeCompare(b.time))
    );
    taskService.update(taskId, patch).catch(console.error);
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    taskService.delete(taskId).catch(console.error);
  }, []);

  // ── Geo-fence actions ──────────────────────────────────────────────────────
  // Detection is native/device-side. These actions update local state and log
  // the event to the backend so it shows up in history.

  const triggerBreach = useCallback(() => {
    const ts = new Date();
    setGeoFenceStatus('outside');
    setBreachTimestamp(ts);
    geofenceService.logBreach(ts).catch(console.error);
  }, []);

  const resolveBreach = useCallback(() => {
    const ts = new Date();
    setGeoFenceStatus('inside');
    setBreachTimestamp(null);
    geofenceService.logResolved(ts).catch(console.error);
  }, []);

  // ── Contact actions ────────────────────────────────────────────────────────

  const addContact = useCallback((contact: Omit<Contact, 'id'>) => {
    contactService.add(contact)
      .then(newContact => setContacts(prev => [...prev, newContact]))
      .catch(console.error);
  }, []);

  const updateContact = useCallback((contactId: string, patch: Partial<Contact>) => {
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, ...patch } : c));
    contactService.update(contactId, patch).catch(console.error);
  }, []);

  const removeContact = useCallback((contactId: string) => {
    setContacts(prev => prev.filter(c => c.id !== contactId));
    contactService.remove(contactId).catch(console.error);
  }, []);

  // ── Settings & elder actions ───────────────────────────────────────────────

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
    settingsService.updateSettings(patch).catch(console.error);
  }, []);

  const updateElder = useCallback((patch: Partial<Elder>) => {
    setElder(prev => ({ ...prev, ...patch }));
    elderService.update(patch).catch(console.error);
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────

  const value: AppContextValue = {
    elder,
    tasks,
    geoFenceStatus,
    breachTimestamp,
    weekHistory,
    weeks,
    contacts,
    settings,
    caregiver,
    markTaskDone,
    undoTaskDone,
    addTask,
    updateTask,
    deleteTask,
    triggerBreach,
    resolveBreach,
    addContact,
    updateContact,
    removeContact,
    updateSettings,
    updateElder,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

// ─── Pure selectors ───────────────────────────────────────────────────────────

export function getCurrentTask(tasks: Task[]): Task | null {
  return tasks.find(t => t.status === 'now') ?? tasks.find(t => t.status === 'pending') ?? null;
}

export function countTasksByStatus(tasks: Task[]) {
  return {
    done:    tasks.filter(t => t.status === 'done').length,
    missed:  tasks.filter(t => t.status === 'missed').length,
    pending: tasks.filter(t => t.status === 'pending' || t.status === 'now').length,
    total:   tasks.length,
  };
}
