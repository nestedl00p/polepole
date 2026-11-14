import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Switch, StyleSheet } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, Input } from '../components/ui';
import { registerForReminders } from '../lib/reminders';
import { ChipRow, WHYS, timeOptions } from '../components/ReminderControls';
import { colors } from '../theme';

const PACE_OPTIONS = [
  { days: 30, label: 'Intensive', desc: '1 lesson/day' },
  { days: 45, label: 'Steady', desc: '~3 lessons / 2 days' },
  { days: 60, label: 'Relaxed', desc: '~1 lesson / 2 days' },
  { days: 90, label: 'Casual', desc: '~1 lesson / 3 days' },
  { days: 180, label: 'Extended', desc: '~1 lesson / 6 days' },
];

export default function SettingsScreen() {
  const { user, setUser, refreshUser, logout } = useAuth();
  const [plan, setPlan] = useState(user.planLengthDays);
  const [custom, setCustom] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      const value = custom ? parseInt(custom, 10) : plan;
      const updated = await api.updatePace(value);
      setUser(updated);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    Alert.alert(
      'Restart the course?',
      'This resets your progress, XP, and streak. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const updated = await api.restart();
              setUser(updated);
              await refreshUser();
              Alert.alert('Course restarted', 'Karibu tena!');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.head}>
        <Text style={styles.h1}>Settings</Text>
        <Text style={styles.muted}>Your reminder, your pace, or a fresh start.</Text>
      </View>

      <ReminderCard user={user} setUser={setUser} />

      <Card style={{ marginBottom: 18 }}>
        <Text style={styles.cardTitle}>Your pace</Text>
        <Text style={[styles.muted, { marginBottom: 14, lineHeight: 21 }]}>
          You're currently on a <Text style={styles.bold}>{user.planLengthDays}-day</Text> plan. You
          can extend it anytime — lessons spread out across more days, but you can always study ahead
          once you pass each quiz.
        </Text>

        <View style={styles.paceGrid}>
          {PACE_OPTIONS.map((p) => {
            const active = !custom && plan === p.days;
            return (
              <Pressable
                key={p.days}
                onPress={() => {
                  setPlan(p.days);
                  setCustom('');
                  setSaved(false);
                }}
                style={[styles.paceOpt, active && styles.paceOptActive]}
              >
                <Text style={styles.paceNum}>{p.days}</Text>
                <Text style={styles.paceLabel}>{p.label}</Text>
                <Text style={styles.paceDesc}>{p.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        <Field label="Or a custom number of days (30–365)">
          <Input
            value={custom}
            onChangeText={(t) => {
              setCustom(t);
              setSaved(false);
            }}
            placeholder="e.g. 120"
            keyboardType="number-pad"
          />
        </Field>

        <View style={styles.saveRow}>
          <Button title={busy ? 'Saving…' : 'Save pace'} onPress={save} disabled={busy} />
          {saved && <Text style={styles.savedNote}>✓ Saved!</Text>}
        </View>
      </Card>

      <Card style={{ marginBottom: 18 }}>
        <Text style={styles.cardTitle}>Danger zone</Text>
        <Text style={[styles.muted, { marginBottom: 14 }]}>
          Restarting wipes all progress and begins the course fresh from Day 1.
        </Text>
        <Button
          title="Restart course"
          variant="ghost"
          onPress={restart}
          disabled={busy}
          style={{ borderColor: colors.danger }}
        />
        <Text />
      </Card>

      <Button title="Log out" variant="ghost" onPress={logout} />
    </ScrollView>
  );
}

// One reminder a day, at a time the learner picks. Each control saves as it
// is changed.
function ReminderCard({ user, setUser }) {
  const [note, setNote] = useState('');

  const update = async (payload) => {
    try {
      setUser(await api.updateReminders(payload));
    } catch (e) {
      setNote(e.message || 'Could not save that.');
    }
  };

  const toggle = async (on) => {
    setNote('');
    await update({ enabled: on });
    if (!on) return;
    // The system prompt appears here, because here is where the learner
    // asked for reminders.
    const outcome = await registerForReminders({ ask: true });
    if (outcome === 'denied') {
      setNote('Notifications are off for PolePole in your phone settings, so nothing will arrive until you allow them there.');
    } else if (outcome === 'unavailable') {
      setNote('This build cannot receive push notifications yet. Your time is saved for when it can.');
    } else {
      setUser(await api.me());
    }
  };

  const setWhy = async (why) => {
    try {
      setUser(await api.updateWhy(user.why === why ? null : why));
    } catch (e) {
      setNote(e.message || 'Could not save that.');
    }
  };

  return (
    <Card style={{ marginBottom: 18 }}>
      <Text style={styles.cardTitle}>Daily reminder</Text>
      <Text style={[styles.muted, { marginBottom: 14, lineHeight: 21 }]}>
        One a day, at the time you choose. It names the words waiting in your dose and nothing else.
      </Text>

      <View style={styles.reminderRow}>
        <Text style={styles.bold}>Remind me</Text>
        <Switch
          value={!!user.remindersEnabled}
          onValueChange={toggle}
          trackColor={{ true: colors.teal, false: colors.line }}
        />
      </View>

      <ChipRow
        options={timeOptions(user.reminderLocalTime)}
        value={user.reminderLocalTime}
        disabled={!user.remindersEnabled}
        onChange={(localTime) => update({ localTime })}
      />

      {note ? <Text style={[styles.muted, styles.reminderNote]}>{note}</Text> : null}

      <Text style={[styles.bold, { marginTop: 18, marginBottom: 8 }]}>What's your why?</Text>
      <ChipRow options={WHYS} value={user.why} onChange={setWhy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  reminderNote: { fontSize: 13, lineHeight: 19, marginTop: 12 },
  page: { padding: 20, paddingBottom: 60, backgroundColor: colors.cream },
  head: { marginBottom: 20 },
  h1: { fontSize: 24, color: colors.navy, fontWeight: '800' },
  muted: { color: colors.muted },
  bold: { fontWeight: '700', color: colors.ink },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.navy, marginBottom: 8 },

  paceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  paceOpt: {
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    // Two across; with five options the last one takes the full final row.
    // At 30% the row broke 3 + 2 and the last two stretched to a different
    // width from the three above them.
    flexGrow: 1,
    flexBasis: '45%',
  },
  paceOptActive: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  paceNum: { fontSize: 22, fontWeight: '800', color: colors.navy },
  paceLabel: { fontWeight: '700', color: colors.ink, fontSize: 13, marginTop: 2 },
  paceDesc: { fontSize: 11.5, color: colors.muted, textAlign: 'center' },

  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  savedNote: { color: colors.success, fontWeight: '700' },
});
