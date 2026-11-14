// The phone's half of the daily reminder.
//
// The server sends one push a day at the time the learner picked (see
// ReminderService in the API). This file does the three things only the device
// can: ask for permission, hand the server this phone's Expo push token, and
// turn a tap on the notification into a deep link that lands *in* the Dose
// rather than on the dashboard.
//
// See docs/DAILY-PRACTICE-LOOP.md, "External triggers".
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { api } from '../api/client';

export const DOSE_URL = 'polepole://dose';

// Shown even when the app is in the foreground: the reminder is still true if
// the learner happens to have the app open on another screen.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

// Ask for permission (when `ask` is true) and register this phone's token with
// the account. Returns 'registered' | 'denied' | 'unavailable'.
//
// With `ask` false it only registers if permission was already granted — that
// is the call made on every launch, which must never put up a prompt by
// itself. The prompt belongs to a moment the learner chose: the onboarding
// step or the switch in Settings.
export async function registerForReminders({ ask = false } = {}) {
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return 'denied';

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Dose ya leo',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    // Expo's push service needs the EAS project id to mint a token. A build
    // without one (Expo Go, or a project never linked with `eas init`) simply
    // has no push; the reminder time is still saved for when it does.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return 'unavailable';

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    const payload = { pushToken };
    const tz = deviceTimeZone();
    if (tz) payload.timeZoneId = tz;
    await api.updateReminders(payload);
    return 'registered';
  } catch {
    return 'unavailable';
  }
}

// Signing out: this phone should stop receiving the account's reminders.
export async function unregisterReminders() {
  try {
    await api.updateReminders({ pushToken: '' });
  } catch {
    /* signing out must not fail over this */
  }
}

const urlOf = (response) => response?.notification?.request?.content?.data?.url ?? null;

// React Navigation `linking` config. A tapped reminder carries
// data.url = "polepole://dose"; feeding it through the same path as any other
// deep link means there is one place that knows how to open the Dose.
export const linking = {
  prefixes: [Linking.createURL('/'), 'polepole://'],
  config: {
    screens: {
      Tabs: {
        screens: {
          Dose: 'dose',
        },
      },
    },
  },
  // Cold start: the app was opened by tapping the notification.
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url) return url;
    return urlOf(await Notifications.getLastNotificationResponseAsync());
  },
  // Warm: the app was already running.
  subscribe(listener) {
    const link = Linking.addEventListener('url', ({ url }) => listener(url));
    const tap = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = urlOf(response);
      if (url) listener(url);
    });
    return () => {
      link.remove();
      tap.remove();
    };
  },
};
