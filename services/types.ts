/**
 * Aurélia — Service interfaces
 *
 * These interfaces are the contract between the app and the backend.
 * Mock implementations (services/mock/) return local data.
 * API implementations (services/api/) make real HTTP calls.
 *
 * When the backend team adds a new endpoint, they implement the
 * corresponding method in services/api/ — the app calls the same interface.
 */

import type {
  AppSettings,
  Contact,
  DayHistory,
  Elder,
  Task,
} from '@/data/mock';

// ─── Caregiver ────────────────────────────────────────────────────────────────
// Defined here (not in mock.ts) because this is what the auth/profile endpoint returns.

export type Caregiver = {
  name: string;
  initials: string;
  email: string;
  role: string;
};

// ─── TaskService ──────────────────────────────────────────────────────────────

export interface TaskService {
  /** Load today's task list for the linked elder. */
  getTodayTasks(): Promise<Task[]>;
  /** Create a new task. The service (not the app) assigns the ID. */
  create(task: Omit<Task, 'id' | 'status'>): Promise<Task>;
  /** Update an existing task's fields. */
  update(taskId: string, patch: Omit<Task, 'id' | 'status'>): Promise<void>;
  /** Delete a task permanently. */
  delete(taskId: string): Promise<void>;
  /** Mark a task as done (caregiver manual confirmation). */
  markDone(taskId: string): Promise<void>;
  /** Revert a done task back to pending. */
  undoMarkDone(taskId: string): Promise<void>;
}

// ─── ElderService ─────────────────────────────────────────────────────────────

export interface ElderService {
  /** Load the elder profile linked to this caregiver account. */
  getElder(): Promise<Elder>;
  /** Patch elder profile fields (name, safe-zone radius, etc.). */
  update(patch: Partial<Elder>): Promise<void>;
}

// ─── ContactService ───────────────────────────────────────────────────────────

export interface ContactService {
  /** Load all emergency contacts for the elder. */
  getContacts(): Promise<Contact[]>;
  /** Add a new contact. The service assigns the ID. */
  add(contact: Omit<Contact, 'id'>): Promise<Contact>;
  /** Update contact fields (name, escalation flag, etc.). */
  update(contactId: string, patch: Partial<Contact>): Promise<void>;
  /** Remove a contact. */
  remove(contactId: string): Promise<void>;
}

// ─── HistoryService ───────────────────────────────────────────────────────────

export interface HistoryService {
  /**
   * Load historical weeks for the elder, oldest → newest.
   * Each element is one week (array of DayHistory).
   */
  getWeeks(): Promise<DayHistory[][]>;
}

// ─── SettingsService ──────────────────────────────────────────────────────────

export interface SettingsService {
  /** Load the logged-in caregiver's profile. */
  getCaregiver(): Promise<Caregiver>;
  /** Load caregiver app settings. */
  getSettings(): Promise<AppSettings>;
  /** Persist a settings patch. */
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
}

// ─── GeofenceService ─────────────────────────────────────────────────────────
// Geo-fence DETECTION is handled by the native device SDK (Expo Location).
// These methods only log events to the backend so they appear in history.

export interface GeofenceService {
  /** Notify the backend that the elder left the safe zone. */
  logBreach(timestamp: Date): Promise<void>;
  /** Notify the backend that the elder returned to the safe zone. */
  logResolved(timestamp: Date): Promise<void>;
}
