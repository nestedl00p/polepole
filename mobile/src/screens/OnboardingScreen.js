import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { registerForReminders } from '../lib/reminders';
import { Button, Card } from '../components/ui';
import { ChipRow, REMINDER_TIMES, WHYS } from '../components/ReminderControls';
import { colors } from '../theme';

// The two questions that come after the taster and the account — and only
// then, because each is easier to answer once the learner has seen what they
// are being reminded *of*:
//
//   "When should I remind you?"  →  "What's your why?"
//
// Both can be skipped, and neither can trap anyone: any failure moves on.
//
// See docs/DAILY-PRACTICE-LOOP.md, "Reminder time and your why".
export default function OnboardingScreen() {
  const { setUser, finishOnboarding } = useAuth();
  const [step, setStep] = useState('reminder');
  const [time, setTime] = useState('08:00');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const saveReminder = async (enabled) => {
    setBusy(true);
    try {
      if (enabled) {
        setUser(await api.updateReminders({ enabled: true, localTime: time }));
        // The system permission prompt appears here, at the moment the
        // learner asked to be reminded — not on first launch, out of nowhere.
        const outcome = await registerForReminders({ ask: true });
        if (outcome === 'denied') {
          setNote('Notifications are off for PolePole in your phone settings, so nothing will arrive until you allow them there.');
        }
      } else {
        setUser(await api.updateReminders({ enabled: false }));
      }
    } catch {
      /* carry on; Settings has the same controls */
    }
    setBusy(false);
    setStep('why');
  };

  const saveWhy = async (why) => {
    setBusy(true);
    try {
      if (why) setUser(await api.updateWhy(why));
    } catch {
      /* not worth holding them here */
    }
    finishOnboarding();
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Card style={styles.card}>
        {step === 'reminder' ? (
          <>
            <Text style={styles.title}>When should I remind you?</Text>
            <Text style={styles.sub}>
              One reminder a day, at a time you pick. It tells you which words are waiting — nothing else.
            </Text>
            <ChipRow options={REMINDER_TIMES} value={time} onChange={setTime} disabled={busy} />
            <Button title="Remind me" style={styles.mt} disabled={busy} onPress={() => saveReminder(true)} />
            <Button title="No reminders" variant="ghost" size="sm" style={styles.mt} disabled={busy} onPress={() => saveReminder(false)} />
          </>
        ) : (
          <>
            <Text style={styles.title}>What's your why?</Text>
            <Text style={styles.sub}>So that if you ever drift away, I can remind you what this was for.</Text>
            {note ? <Text style={styles.note}>{note}</Text> : null}
            <ChipRow options={WHYS} value={null} onChange={saveWhy} disabled={busy} />
            <Button title="Skip" variant="ghost" size="sm" style={styles.mt} disabled={busy} onPress={() => saveWhy(null)} />
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.cream },
  card: { alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  sub: { color: colors.muted, textAlign: 'center', lineHeight: 21, marginTop: 6, marginBottom: 18 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 14 },
  mt: { marginTop: 16 },
});
