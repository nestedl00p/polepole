import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { setSpeechCourse } from '../lib/speak';
import { BareScreen, Button, Card, Field, Input, ErrorBox, Spinner } from '../components/ui';
import SpeakButton from '../components/SpeakButton';
import { colors, radius } from '../theme';

// The first screen a new learner sees: three words, before any account.
// Mirrors the web TasterPage.
//
// Sign-up used to come first. Here the order is the design's: three items,
// then the reward (a score and a proverb), then "keep your progress?" — the
// account, offered as a way to keep what was just done. The reminder time and
// the why are asked after that, on OnboardingScreen.
//
// See docs/DAILY-PRACTICE-LOOP.md, "Reminder time and your why".

const LABELS = {
  tambua: 'WHAT DOES THIS MEAN?',
  tunga: 'WHICH WORD IS THIS?',
};

export default function TasterScreen({ navigation }) {
  const { register } = useAuth();
  const [course, setCourse] = useState('sw');
  const [taster, setTaster] = useState(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState('items'); // items | reward | account
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    setTaster(null); setFailed(false);
    setStep('items'); setIdx(0); setPicked(null); setResult(null); setAnswers([]);
    api.taster(course)
      .then((t) => {
        setTaster(t);
        // Point the speaker button at the language being learned, as signing
        // in would — there is no account yet to do it.
        setSpeechCourse(course === 'en' ? { id: 'en', ttsLocale: 'en-US' } : { id: 'sw', ttsLocale: 'sw-KE' });
      })
      .catch(() => setFailed(true));
  }, [course]);

  const toLogin = () => navigation.navigate('Auth');

  if (failed || (taster && !taster.items.length)) {
    return (
      <BareScreen>
        <Card>
          <Text style={styles.muted}>Couldn't load the taster.</Text>
          <Button title="Create an account or log in" style={styles.mt} onPress={toLogin} />
        </Card>
      </BareScreen>
    );
  }
  if (!taster) return <Spinner />;

  const items = taster.items;
  const item = items[idx];

  const choose = async (opt) => {
    if (result || picked) return;
    setPicked(opt);
    try {
      const res = await api.answerTaster({ course, itemKey: item.itemKey, exercise: item.exercise, answer: opt });
      setResult(res);
      setAnswers((a) => [...a, { itemKey: item.itemKey, exercise: item.exercise, answer: opt, correct: res.correct }]);
    } catch {
      setPicked(null);
    }
  };

  const next = () => {
    setPicked(null); setResult(null);
    if (idx + 1 < items.length) setIdx(idx + 1);
    else setStep('reward');
  };

  let body;

  if (step === 'items') {
    body = (
      <>
        <View style={styles.headRow}>
          <Text style={styles.kicker}>THREE WORDS · ABOUT 30 SECONDS</Text>
          <Pressable onPress={toLogin} hitSlop={10}><Text style={styles.link}>Log in</Text></Pressable>
        </View>

        <View style={styles.progress}>
          {items.map((_, i) => (
            <View key={i} style={[styles.dot, i < idx && styles.dotDone, i === idx && styles.dotActive]} />
          ))}
          <Text style={styles.count}>{idx + 1} / {items.length}</Text>
        </View>

        <Text style={styles.label}>{LABELS[item.exercise]}</Text>
        <View style={styles.promptRow}>
          <Text style={styles.prompt}>{item.prompt}</Text>
          {item.exercise === 'tambua' && <SpeakButton text={item.prompt} />}
        </View>

        {item.options.map((opt) => {
          const isPicked = picked === opt;
          const isAnswer = result && opt === result.correctAnswer;
          return (
            <Pressable
              key={opt}
              onPress={() => choose(opt)}
              disabled={!!result || !!picked}
              style={[
                styles.option,
                !result && isPicked && styles.optionSelected,
                result && isAnswer && styles.optionRight,
                result && isPicked && !isAnswer && styles.optionWrong,
                result && !isAnswer && !isPicked && styles.optionDim,
              ]}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          );
        })}

        {result && (
          <View style={styles.feedback}>
            <Text style={{ color: result.correct ? colors.success : colors.danger, fontWeight: '800' }}>
              {result.correct ? '✓ Sawa!' : `✗ It's "${result.correctAnswer}"`}
            </Text>
            <Button title={idx + 1 < items.length ? 'Next →' : 'Finish'} variant="gold" style={styles.mt} onPress={next} />
          </View>
        )}

        {idx === 0 && !result && (
          <Pressable onPress={() => setCourse(course === 'sw' ? 'en' : 'sw')} style={styles.mt} hitSlop={8}>
            <Text style={[styles.link, { textAlign: 'center' }]}>
              {course === 'sw' ? 'Unajifunza Kiingereza? Jaribu kwa Kiingereza' : 'Learning Swahili? Try the Swahili one'}
            </Text>
          </Pressable>
        )}
      </>
    );
  } else if (step === 'reward') {
    const right = answers.filter((a) => a.correct).length;
    body = (
      <View style={styles.centered}>
        <Text style={styles.kicker}>THAT'S A DOSE</Text>
        <Text style={styles.score}>{right}/{answers.length}</Text>
        <Text style={[styles.muted, { textAlign: 'center' }]}>
          {course === 'sw'
            ? 'Three words of Swahili you did not have a minute ago.'
            : 'Maneno matatu ya Kiingereza ambayo hukuwa nayo dakika moja iliyopita.'}
        </Text>

        {taster.methali && (
          <View style={styles.methali}>
            <Text style={styles.label}>AND ONE TO KEEP</Text>
            <View style={styles.methaliRow}>
              <Text style={styles.methaliText}>{taster.methali.target}</Text>
              <SpeakButton text={taster.methali.target} />
            </View>
            <Text style={styles.methaliGloss}>{taster.methali.source}</Text>
            {taster.methali.note ? <Text style={styles.methaliNote}>{taster.methali.note}</Text> : null}
          </View>
        )}

        <Button title="Keep your progress →" variant="gold" style={styles.mt} onPress={() => setStep('account')} />
        <Text style={[styles.muted, styles.small, styles.mt]}>
          A free account saves these words and brings them back when you are about to forget them.
        </Text>
      </View>
    );
  } else {
    body = (
      <AccountStep
        onLogin={toLogin}
        onSubmit={(form) => register(
          {
            ...form,
            planLengthDays: 30,
            courseId: course,
            // Replayed and re-graded by the server, so the cards it creates
            // are the ones these answers earned.
            tasterAnswers: answers.map(({ itemKey, exercise, answer }) => ({ itemKey, exercise, answer })),
          },
          // Carry on to the reminder and the why once the account exists.
          { onboard: true },
        )}
      />
    );
  }

  return (
    <BareScreen keyboard>
      <Card>{body}</Card>
    </BareScreen>
  );
}

function AccountStep({ onSubmit, onLogin }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await onSubmit({ displayName, email, password });
      // The navigator swaps to onboarding once `user` is set in context.
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <>
      <Text style={styles.title}>Keep your progress</Text>
      <Text style={[styles.muted, { marginBottom: 14 }]}>Your three words and the proverb are saved to this account.</Text>
      <ErrorBox>{error}</ErrorBox>
      <Field label="Display name">
        <Input value={displayName} onChangeText={setDisplayName} placeholder="e.g. Amani" />
      </Field>
      <Field label="Email">
        <Input value={email} onChangeText={setEmail} placeholder="you@example.com"
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label="Password">
        <Input value={password} onChangeText={setPassword} placeholder="At least 6 characters"
          secureTextEntry autoCapitalize="none" />
      </Field>
      <Button title={busy ? 'Please wait…' : 'Create account'} block disabled={busy} onPress={submit} />
      <Pressable onPress={onLogin} style={styles.mt} hitSlop={8}>
        <Text style={[styles.link, { textAlign: 'center' }]}>Already have an account? Log in</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center' },
  muted: { color: colors.muted, lineHeight: 21 },
  small: { fontSize: 13, textAlign: 'center' },
  mt: { marginTop: 14 },
  link: { color: colors.tealDark, fontWeight: '700', fontSize: 14 },
  title: { fontSize: 24, fontWeight: '800', color: colors.navy, marginBottom: 4 },

  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '800', color: colors.gold, letterSpacing: 1.4 },
  score: { fontSize: 44, fontWeight: '800', color: colors.tealDark },

  progress: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
  dot: { width: 9, height: 9, borderRadius: 50, backgroundColor: colors.line },
  dotDone: { backgroundColor: colors.success },
  dotActive: { backgroundColor: colors.gold, transform: [{ scale: 1.25 }] },
  count: { marginLeft: 'auto', color: colors.muted, fontSize: 13, fontWeight: '700' },

  label: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1, marginBottom: 10 },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  prompt: { fontSize: 26, fontWeight: '800', color: colors.navy, marginBottom: 14 },

  option: {
    borderWidth: 1.5, borderColor: colors.line, borderRadius: 10,
    paddingVertical: 13, paddingHorizontal: 16, marginBottom: 10, backgroundColor: '#fff',
  },
  optionSelected: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  optionRight: { borderColor: colors.success, backgroundColor: colors.successTint },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  optionDim: { opacity: 0.5 },
  optionText: { fontSize: 16, color: colors.ink, fontWeight: '600' },
  feedback: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 },

  methali: {
    alignSelf: 'stretch', alignItems: 'center', marginTop: 18, padding: 16,
    borderWidth: 2, borderColor: colors.gold, borderRadius: radius,
  },
  methaliRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  methaliText: { fontSize: 21, fontWeight: '800', color: colors.navy, textAlign: 'center', lineHeight: 29 },
  methaliGloss: { color: colors.tealDark, fontSize: 15.5, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  methaliNote: { color: colors.muted, fontSize: 13.5, lineHeight: 20, marginTop: 10, textAlign: 'center' },
});
