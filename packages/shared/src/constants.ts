export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export const MISSED_TASK_TIMEOUT_OPTIONS = [15, 30, 60] as const;
export const DEFAULT_MISSED_TASK_TIMEOUT_MIN = 30 as const;

/** Metres added to / subtracted from the safe-zone radius before a reading counts as outside / inside. */
export const GEOFENCE_HYSTERESIS_M = 15;
/** Consecutive agreeing readings required before the location status changes. */
export const GEOFENCE_CONFIRM_READINGS = 2;

export const PAIRING_CODE_TTL_MIN = 15;
/** An invite for another caregiver is usually sent by message and opened later, so it lasts longer. */
export const CAREGIVER_INVITE_TTL_HOURS = 48;

export const MAX_EMERGENCY_CONTACTS = 5;

/**
 * With `escalation: 'meThenContacts'`, an SOS or safe-zone exit no caregiver has acknowledged after this
 * many minutes is texted to the elder's emergency contacts.
 */
export const ESCALATE_AFTER_MIN = 5;
/** Alerts older than this are never escalated (a late job run must not text about yesterday's SOS). */
export const ESCALATION_WINDOW_MIN = 60;

/**
 * From this local time on, Aurélia writes the day's summary for the caregivers who turned on
 * "Insights da Aurélia" (one per elder per day, only on days with something to tell).
 */
export const DAILY_SUMMARY_TIME = '20:00';

/** "Sobre ela": what the caregivers tell Aurélia about the elder, read in every conversation. */
export const ELDER_ABOUT_MAX_CHARS = 2000;
/** A conversation with Aurélia that has been quiet this long is over, and gets summarised for her memory. */
export const ASSISTANT_CONVERSATION_IDLE_MIN = 10;
/** How many conversation summaries Aurélia is given to remember, newest first. */
export const ASSISTANT_MEMORIES_IN_PROMPT = 12;
