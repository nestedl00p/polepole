// The web half of the daily reminder.
//
// On a phone the reminder is a push: the server sends it at the time the
// learner picked, whether or not the app is open. A browser has no equivalent
// without a service worker and a push subscription, which this app does not
// have — so here the page shows the notification itself, and can only do that
// while PolePole is open in a tab. That limit is stated to the learner where
// they switch reminders on, rather than left for them to discover.
//
// The rules are the server's (see ReminderService): one a day, never to
// someone who has already finished, never late, and the copy names the words
// waiting — never the streak.
//
// See docs/DAILY-PRACTICE-LOOP.md, "External triggers".
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

// How long after the chosen time the reminder may still be shown. Matches
// ReminderService.Window.
const WINDOW_MS = 60 * 60 * 1000;

const SHOWN_KEY = 'polepole_reminder_shown';

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export const notificationPermission = () => (notificationsSupported() ? Notification.permission : 'unsupported');

// Must be called from a click: browsers ignore permission requests that do
// not come from a user gesture.
export async function askNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function shownToday() {
  try { return localStorage.getItem(SHOWN_KEY) === localDay(); } catch { return false; }
}

function markShown() {
  try { localStorage.setItem(SHOWN_KEY, localDay()); } catch { /* private mode: at worst it shows twice */ }
}

// Today's reminder instant in the device's own zone — the same zone the
// account's TimeZoneId is kept in step with (see AuthContext.syncTimeZone).
function todayAt(hhmm) {
  const [h, m] = (hhmm || '08:00').split(':').map(Number);
  const t = new Date();
  t.setHours(h || 0, m || 0, 0, 0);
  return t;
}

async function show(navigate) {
  if (shownToday()) return;

  // Asked fresh rather than trusted from when the timer was set: the learner
  // may have done the dose in the meantime, here or on their phone.
  let dose;
  try {
    dose = await api.dose();
  } catch {
    return;
  }
  if (!dose?.items?.length || dose.alreadyDoneToday) return;

  // A vocab card's key is the word being learned. Proverbs are left out of
  // the preview so they stay a surprise.
  const words = dose.items.filter((i) => i.kind === 'vocab').slice(0, 3).map((i) => i.itemKey);
  const body = `${dose.items.length} cards, 90 seconds.${words.length ? ` ${words.join(', ')}…` : ''}`;

  markShown();
  const n = new Notification('Dose ya leo', { body, tag: 'polepole-dose', icon: '/polepole-icon-512.png' });
  n.onclick = () => {
    window.focus();
    navigate('/dose');
    n.close();
  };

  // The server has no other way to know a reminder went out on the web, and
  // needs to: an open that follows it was prompted, not habitual.
  api.reminderShown().catch(() => {});
}

// Arms today's reminder for the signed-in learner. Mounted once, in App.
export function useDoseReminder(user) {
  const navigate = useNavigate();
  const enabled = !!user?.remindersEnabled;
  const time = user?.reminderLocalTime;
  const done = !!user?.doneToday;

  useEffect(() => {
    if (!enabled || done || notificationPermission() !== 'granted' || shownToday()) return undefined;

    const wait = todayAt(time).getTime() - Date.now();
    // More than an hour past the chosen time: dropped, not delivered late.
    if (wait < -WINDOW_MS) return undefined;

    const timer = setTimeout(() => show(navigate), Math.max(wait, 0));
    return () => clearTimeout(timer);
  }, [enabled, time, done, navigate]);
}
