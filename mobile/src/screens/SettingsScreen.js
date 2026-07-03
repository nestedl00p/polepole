import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, Input } from '../components/ui';
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
        <Text style={styles.muted}>Adjust your learning pace or restart the course.</Text>
      </View>

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

const styles = StyleSheet.create({
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
    flexGrow: 1,
    flexBasis: '30%',
  },
  paceOptActive: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  paceNum: { fontSize: 22, fontWeight: '800', color: colors.navy },
  paceLabel: { fontWeight: '700', color: colors.ink, fontSize: 13, marginTop: 2 },
  paceDesc: { fontSize: 11.5, color: colors.muted, textAlign: 'center' },

  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  savedNote: { color: colors.success, fontWeight: '700' },
});
