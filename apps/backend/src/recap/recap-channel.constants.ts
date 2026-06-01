/** Read-only channel for automated upcoming-event reminders (acknowledge via reaction). */
export const EVENT_REMINDERS_CHANNEL = 'event-reminders';

export const RECAP_SYSTEM_USER_EXTERNAL_ID = 'recap-system';

/** Reaction emoji used as "I acknowledge this reminder". */
export const EVENT_REMINDER_ACK_EMOJI = '✅';

export function isReadOnlyBroadcastChannel(channelName: string | null | undefined): boolean {
  return channelName === EVENT_REMINDERS_CHANNEL;
}
