import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Share, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { Button, Card, Spinner, Input } from '../components/ui';
import WeekStrip from '../components/WeekStrip';
import SpeakButton from '../components/SpeakButton';
import { colors, radius, shadow } from '../theme';

// "Dose ya leo" — the daily practice loop on mobile. Mirrors the web DosePage:
// five items, about ninety seconds, one spoken aloud.
//
// The same three deliberate choices as the web page: nothing to decide before
// starting, the dose ends by itself, and strength is revealed only after
// answering. "Endelea" is secondary and earns nothing extra.
//
// See docs/DAILY-PRACTICE-LOOP.md.

const LABELS = {
  tambua: 'What does this mean?',
  tunga: 'Which word is this?',
  sema: 'Say it out loud',
  methali: 'Methali — a proverb for you',
};

// How long the learner took to answer. Feeds the strength bar and the XP
// award, so a word answered instantly counts for more than one worked out.
function useElapsed(key) {
  const started = useRef(Date.now());
  useEffect(() => { started.current = Date.now(); }, [key]);
  return () => Date.now() - started.current;
}

const scoreColor = (s) => (s >= 80 ? colors.success : s >= 55 ? colors.gold : colors.danger);

export default function DoseScreen({ navigation }) {
  const { refreshUser } = useAuth();
  const [dose, setDose] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);
  const [closing, setClosing] = useState(null);   // result of POST /dose/complete

  const load = useCallback(() => {
    setLoading(true);
    setIdx(0);
    setResult(null);
    setLog([]);
    setDone(false);
    setClosing(null);
    api.dose().then(setDose).catch(() => setDose(null)).finally(() => setLoading(false));
  }, []);

  // Reload on focus so a lesson finished in between shows up in the queue.
  // Coming to this screen is also what counts as opening the Dose — the
  // server compares it with when the day's reminder went out. An "endelea"
  // round calls load() directly and so is not counted as a second open.
  useFocusEffect(useCallback(() => {
    load();
    api.openDose().catch(() => {});
  }, [load]));

  if (loading) return <Spinner />;

  if (!dose) {
    return (
      <View style={styles.page}>
        <Card><Text style={styles.muted}>Could not load today's dose.</Text></Card>
      </View>
    );
  }

  if (dose.message || !dose.items?.length) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Card style={styles.centered}>
          <Text style={styles.kicker}>DOSE YA LEO</Text>
          <Text style={styles.h1}>Not yet</Text>
          <Text style={[styles.muted, styles.mt]}>
            {dose.message || 'Nothing is due today.'}
          </Text>
          <Button
            title="Go to a lesson →"
            style={styles.mt}
            onPress={() => navigation.navigate('Dashboard')}
          />
        </Card>
      </ScrollView>
    );
  }

  const items = dose.items;
  const item = items[idx];
  const correctCount = log.filter((e) => e.correct).length;

  const onAnswered = (res) => {
    setResult(res);
    setLog((l) => [...l, { item, correct: res.correct, strength: res.strength }]);
  };

  // Finishing closes the dose server-side, which is what credits the day. The
  // streak is not claimed by the client: the API counts the cards actually
  // touched today, so an abandoned session earns nothing.
  const finish = async () => {
    setDone(true);
    try {
      setClosing(await api.completeDose());
      await refreshUser();
    } catch {
      /* the answers are saved; the day can be credited on the next visit */
    }
  };

  const advance = () => {
    setResult(null);
    if (idx + 1 < items.length) setIdx(idx + 1);
    else finish();
  };

  if (done) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Card style={styles.centered}>
          <Text style={styles.kicker}>DOSE YA LEO</Text>
          <Text style={styles.score}>{correctCount}/{log.length}</Text>
          <Text style={styles.pass}>Umemaliza! That's today done.</Text>
          <Text style={[styles.muted, styles.mt, { textAlign: 'center' }]}>
            {log.length === 0
              ? 'Nothing recorded this time.'
              : "Each answer moved that word in your queue — tomorrow's dose is built from what you just did."}
          </Text>

          {/* Arrives as news: nothing in the app counts toward these, so the
              learner was not watching a bar fill. */}
          {closing?.milestones?.map((m) => (
            <View key={m.key} style={styles.milestone}>
              <Text style={styles.milestoneTitle}>🏅 {m.title}</Text>
              <Text style={styles.milestoneDetail}>{m.detail}</Text>
            </View>
          ))}

          {closing?.xpEarned > 0 && (
            <Text style={styles.xpTotal}>+{closing.xpEarned} XP for finishing</Text>
          )}

          <WeekStrip week={closing?.week} style={styles.mt} />

          {closing?.streakAdvanced && (
            <View style={styles.streak}>
              <Text style={styles.streakNum}>{closing.streakCount} 🔥</Text>
              <Text style={styles.streakLbl}>
                {closing.streakCount === 1 ? 'DAY' : 'DAYS'} IN A ROW
              </Text>
              {/* Said plainly rather than hidden: a streak the learner cannot
                  account for is worse than a broken one. */}
              {closing.restDayUsed && (
                <Text style={styles.rest}>
                  Siku ya mapumziko — you missed a day and it has been covered. The
                  next one is available in a week.
                </Text>
              )}
            </View>
          )}

          {log.length > 0 && (
            <View style={styles.summary}>
              {log.map((e, i) => (
                <View key={i} style={styles.summaryRow}>
                  <Text style={{ color: e.correct ? colors.success : colors.danger, fontWeight: '800' }}>
                    {e.correct ? '✓' : '✗'}
                  </Text>
                  {/* A proverb's key is an index ("methali:3"), not something to show. */}
                  <Text style={styles.summaryWord} numberOfLines={1}>
                    {e.item.kind === 'methali' ? (e.item.target || 'Methali') : e.item.itemKey}
                  </Text>
                  <View style={styles.strengthTrack}>
                    <View style={[styles.strengthFill, { width: `${e.strength}%` }]} />
                  </View>
                  <Text style={styles.strengthPct}>{e.strength}%</Text>
                </View>
              ))}
            </View>
          )}

          {/* After the reward, never before it — and the server sends at most
              one of these per completion. */}
          {closing && <ClosingAsk closing={closing} onChanged={refreshUser} />}

          <Button
            title="Done for today"
            style={styles.mt}
            onPress={() => navigation.navigate('Dashboard')}
          />
          {/* Secondary and unrewarded on purpose. */}
          <Button title="Endelea — a few more" variant="ghost" size="sm" style={styles.mt} onPress={load} />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.progress}>
        {items.map((_, i) => (
          <View key={i} style={[styles.dot, i < idx && styles.dotDone, i === idx && styles.dotActive]} />
        ))}
        <Text style={styles.count}>{idx + 1} / {items.length}</Text>
      </View>

      <Card>
        <Text style={styles.label}>{LABELS[item.exercise]?.toUpperCase()}</Text>

        {item.exercise === 'methali' ? (
          <MethaliItem item={item} result={result} onAnswered={onAnswered} />
        ) : item.exercise === 'sema' ? (
          <SemaItem item={item} result={result} onAnswered={onAnswered} onSkip={advance} />
        ) : (
          <TapItem item={item} result={result} onAnswered={onAnswered} />
        )}

        {/* A proverb has no right answer to reveal — acknowledging it is the
            whole interaction, and it joins the review queue from tomorrow. */}
        {result && item.exercise === 'methali' && (
          <View style={styles.feedback}>
            {result.xpEarned > 0 && (
              <Text style={{ color: colors.success, fontWeight: '800' }}>
                Imehifadhiwa — saved to your deck  +{result.xpEarned} XP
              </Text>
            )}
            <PinButton key={item.itemKey} itemKey={item.itemKey} initial={item.pinned} />
            <Button
              title={idx + 1 < items.length ? 'Next →' : 'Finish'}
              variant="gold"
              style={styles.mt}
              onPress={advance}
            />
          </View>
        )}

        {result && item.exercise !== 'methali' && (
          <View style={styles.feedback}>
            <Text style={{ color: result.correct ? colors.success : colors.danger, fontWeight: '800' }}>
              {result.correct ? '✓ Sawa!' : `✗ It's "${result.correctAnswer}"`}
              {result.xpEarned > 0 ? `  +${result.xpEarned} XP` : ''}
            </Text>
            <View style={styles.strengthRow}>
              <Text style={styles.strengthLbl}>STRENGTH</Text>
              <View style={styles.strengthTrack}>
                <View style={[styles.strengthFill, { width: `${result.strength}%` }]} />
              </View>
              <Text style={styles.strengthPct}>{result.strength}%</Text>
            </View>
            <PinButton key={item.itemKey} itemKey={item.itemKey} initial={item.pinned} />
            <Text style={[styles.muted, styles.when]}>
              {result.intervalDays === 0
                ? 'Coming back again shortly.'
                : result.intervalDays === 1
                  ? 'Back tomorrow.'
                  : `Back in ${result.intervalDays} days.`}
            </Text>
            <Button
              title={idx + 1 < items.length ? 'Next →' : 'Finish'}
              variant="gold"
              style={styles.mt}
              onPress={advance}
            />
          </View>
        )}
      </Card>

      <Text style={styles.foot}>{items.length} items · about 90 seconds</Text>
    </ScrollView>
  );
}

// The bonus. Not a test — the learner is handed something they can use, and
// the only thing asked of them is to read it.
function MethaliItem({ item, result, onAnswered }) {
  const [busy, setBusy] = useState(false);

  const keep = async () => {
    if (result || busy) return;
    setBusy(true);
    try {
      onAnswered(await api.answerDose({ itemKey: item.itemKey, exercise: 'methali' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={styles.methali}>
        <View style={styles.methaliRow}>
          <Text style={styles.methaliText}>{item.target}</Text>
          <SpeakButton text={item.target} />
        </View>
        <Text style={styles.methaliGloss}>{item.prompt}</Text>
        {item.note ? <Text style={styles.methaliNote}>{item.note}</Text> : null}
      </View>

      {!result && (
        <Button
          title={busy ? 'Saving…' : 'Nimeelewa — got it'}
          variant="gold"
          style={styles.mt}
          onPress={keep}
        />
      )}
    </>
  );
}

function TapItem({ item, result, onAnswered }) {
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const elapsed = useElapsed(item.itemKey);

  useEffect(() => { setPicked(null); setBusy(false); }, [item.itemKey]);

  const choose = async (opt) => {
    if (result || busy) return;
    setPicked(opt);
    setBusy(true);
    try {
      onAnswered(await api.answerDose({
        itemKey: item.itemKey,
        exercise: item.exercise,
        answer: opt,
        elapsedMs: elapsed(),
      }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={styles.promptRow}>
        <Text style={styles.prompt}>{item.prompt}</Text>
        {/* Sounded out only when the prompt is the language being learned —
            speaking the translation would give away a `tunga` answer. */}
        {item.exercise === 'tambua' && <SpeakButton text={item.prompt} />}
      </View>

      {item.options.map((opt, i) => {
        const isPicked = picked === opt;
        const isAnswer = result && opt === result.correctAnswer;
        return (
          <Pressable
            key={i}
            onPress={() => choose(opt)}
            disabled={!!result || busy}
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
    </>
  );
}

function SemaItem({ item, result, onAnswered, onSkip }) {
  const [phase, setPhase] = useState('idle'); // idle | recording | checking | error
  const [assessed, setAssessed] = useState(null);
  const [enabled, setEnabled] = useState(null);
  const [err, setErr] = useState(null);
  const [takeUri, setTakeUri] = useState(null);   // the recording just scored
  const [kept, setKept] = useState('no');         // no | saving | yes | error
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const elapsed = useElapsed(item.itemKey);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/speech/status`)
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((j) => setEnabled(!!j.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    setPhase('idle'); setAssessed(null); setErr(null); setTakeUri(null); setKept('no');
  }, [item.itemKey]);

  // Keeping a take is the learner's own act, one tap, after they have seen
  // the score. Nothing is stored unless they ask.
  const keep = async () => {
    if (!takeUri || kept === 'saving' || kept === 'yes') return;
    setKept('saving');
    try {
      await api.keepVoiceTake(takeUri, item.itemKey, assessed.score);
      setKept('yes');
    } catch {
      setKept('error');
    }
  };

  const startRec = async () => {
    setErr(null);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { setErr('Microphone permission is needed to practice speaking.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setAssessed(null);
      setPhase('recording');
    } catch {
      setErr('Could not start recording on this device.');
    }
  };

  const stopRec = async () => {
    setPhase('checking');
    try {
      await recorder.stop();
      const form = new FormData();
      form.append('file', { uri: recorder.uri, name: 'take.m4a', type: 'audio/m4a' });
      form.append('referenceText', item.target);
      const res = await fetch(`${API_BASE_URL}/api/speech/assess`, { method: 'POST', body: form });
      if (!res.ok) throw new Error('assess failed');
      const a = await res.json();
      setAssessed(a);
      setTakeUri(recorder.uri);
      onAnswered(await api.answerDose({
        itemKey: item.itemKey,
        exercise: 'sema',
        speechScore: Math.round(a.score),
        elapsedMs: elapsed(),
      }));
      setPhase('idle');
    } catch {
      setPhase('error');
    }
  };

  return (
    <>
      <View style={styles.promptRow}>
        <Text style={styles.promptSema}>{item.target}</Text>
        <SpeakButton text={item.target} />
      </View>
      <Text style={styles.gloss}>{item.prompt}</Text>

      {enabled === false ? (
        <>
          <Text style={styles.note}>
            Speak-and-check needs the pronunciation service running. Tap 🔊 to hear it, then carry on.
          </Text>
          <Button title="Skip this one →" variant="ghost" size="sm" style={styles.mt} onPress={onSkip} />
        </>
      ) : (
        <>
          <Pressable
            onPress={phase === 'recording' ? stopRec : startRec}
            disabled={phase === 'checking' || !!result}
            style={[styles.mic, phase === 'recording' && styles.micRec]}
          >
            <Text style={styles.micText}>
              {phase === 'recording' ? '■ Stop' : phase === 'checking' ? 'Checking…' : '🎤 Speak'}
            </Text>
          </Pressable>
          {err && <Text style={styles.err}>{err}</Text>}

          {assessed && (
            <View style={styles.semaResult}>
              <Text style={[styles.semaScore, { color: scoreColor(assessed.score) }]}>
                {Math.round(assessed.score)}%
              </Text>
              <Text style={styles.muted}>match</Text>
            </View>
          )}

          {assessed && takeUri && (
            <Button
              title={kept === 'yes' ? '✓ Kept' : kept === 'saving' ? 'Saving…' : 'Hifadhi sauti — keep this take'}
              variant="ghost"
              size="sm"
              style={styles.mt}
              disabled={kept === 'saving' || kept === 'yes'}
              onPress={keep}
            />
          )}
          {kept === 'error' && <Text style={styles.err}>Couldn't save that one.</Text>}

          {phase === 'error' && (
            <>
              <Text style={styles.err}>Couldn't reach the pronunciation service.</Text>
              <Button title="Skip this one →" variant="ghost" size="sm" style={styles.mt} onPress={onSkip} />
            </>
          )}

          {!result && phase === 'idle' && !assessed && (
            <Button title="Skip this one →" variant="ghost" size="sm" style={styles.mt} onPress={onSkip} />
          )}
        </>
      )}
    </>
  );
}

// "Nitakumbuka hii" — I will remember this. One tap to make a card the
// learner's own; pinned cards are favoured when future doses are built.
function PinButton({ itemKey, initial }) {
  const [pinned, setPinned] = useState(!!initial);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.pinCard(itemKey, !pinned);
      setPinned(res.pinned);
    } catch {
      /* leave it as it was */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={toggle}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ selected: pinned }}
      style={[styles.pin, pinned && styles.pinOn]}
    >
      <Text style={[styles.pinText, pinned && styles.pinTextOn]}>
        📌 {pinned ? 'Pinned — it will come up more often' : 'Nitakumbuka hii — pin this'}
      </Text>
    </Pressable>
  );
}

// The one thing the completion card may ask. Each is dismissable in a tap,
// and none comes back: the server records an ask as made when it sends it.
function ClosingAsk({ closing, onChanged }) {
  const [state, setState] = useState('open'); // open | done | dismissed
  const [answer, setAnswer] = useState('');

  if (state === 'dismissed') return null;

  // A product that offers to stop notifying you is one confident it has
  // built a habit rather than rented one.
  if (closing.offerStopReminders) {
    const stop = async () => {
      try { await api.updateReminders({ enabled: false }); await onChanged(); } catch { /* Settings has the switch */ }
      setState('done');
    };
    return (
      <View style={styles.ask}>
        {state === 'done' ? (
          <Text style={styles.askDone}>Sawa — no more reminders. You can turn them back on in Settings.</Text>
        ) : (
          <>
            <Text style={styles.askTitle}>You've started on your own 14 days running.</Text>
            <Text style={styles.askBody}>Want me to stop reminding you?</Text>
            <Button title="Yes, stop reminding me" size="sm" onPress={stop} />
            <Button title="Keep them" variant="ghost" size="sm" style={styles.askGap} onPress={() => setState('dismissed')} />
          </>
        )}
      </View>
    );
  }

  if (closing.askHabitQuestion) {
    const send = async () => {
      if (!answer.trim()) return;
      try { await api.habitAnswer(answer.trim()); } catch { /* not worth interrupting them over */ }
      setState('done');
    };
    return (
      <View style={styles.ask}>
        {state === 'done' ? (
          <Text style={styles.askDone}>Asante — that helps.</Text>
        ) : (
          <>
            <Text style={styles.askTitle}>One question, once.</Text>
            <Text style={styles.askBody}>What makes you open this?</Text>
            <Input value={answer} onChangeText={setAnswer} maxLength={280} placeholder="In your own words" style={styles.askInput} />
            <Button title="Send" size="sm" disabled={!answer.trim()} onPress={send} />
            <Button title="Skip" variant="ghost" size="sm" style={styles.askGap} onPress={() => setState('dismissed')} />
          </>
        )}
      </View>
    );
  }

  // Weekly at most, and only on the learner's say-so: the words leave the
  // phone through the system share sheet, to whoever they pick. The app sends
  // nothing by itself. (The web client can attach the learner's own recording;
  // here it is the text.)
  if (closing.shareOffer) {
    const offer = closing.shareOffer;
    const send = async () => {
      try {
        const res = await Share.share({ message: offer.gloss ? `${offer.text} — "${offer.gloss}"` : offer.text });
        if (res.action !== Share.dismissedAction) setState('done');
      } catch {
        /* closing the sheet is a "no", not an error */
      }
    };
    return (
      <View style={styles.ask}>
        <Text style={styles.askTitle}>You can say this now.</Text>
        <Text style={styles.askQuote}>{offer.text}</Text>
        {offer.gloss ? <Text style={styles.askBody}>{offer.gloss}</Text> : null}
        {state === 'done' ? (
          <Text style={styles.askDone}>Sent on its way.</Text>
        ) : (
          <>
            <Button title="Send it to someone" size="sm" onPress={send} />
            <Button title="Not now" variant="ghost" size="sm" style={styles.askGap} onPress={() => setState('dismissed')} />
          </>
        )}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  pin: {
    alignSelf: 'flex-start', marginTop: 12, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: '#fff',
  },
  pinOn: { borderColor: colors.gold, backgroundColor: colors.goldTint },
  pinText: { fontSize: 13.5, fontWeight: '600', color: colors.muted },
  pinTextOn: { color: '#8a5a00' },

  ask: {
    alignSelf: 'stretch', alignItems: 'center', marginTop: 18, padding: 16,
    borderRadius: radius, backgroundColor: colors.light, borderWidth: 1, borderColor: colors.line,
  },
  askTitle: { fontWeight: '800', color: colors.navy, textAlign: 'center', fontSize: 15.5 },
  askBody: { color: colors.muted, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  askQuote: { fontSize: 20, fontWeight: '800', color: colors.tealDark, textAlign: 'center', marginTop: 8 },
  askDone: { color: colors.tealDark, fontWeight: '600', textAlign: 'center' },
  askInput: { alignSelf: 'stretch', marginBottom: 12 },
  askGap: { marginTop: 8 },

  page: { padding: 20, paddingBottom: 60, backgroundColor: colors.cream, flexGrow: 1 },
  centered: { alignItems: 'center' },
  muted: { color: colors.muted },
  mt: { marginTop: 14 },

  kicker: {
    fontSize: 11, fontWeight: '800', color: colors.gold,
    letterSpacing: 1.4, marginBottom: 4,
  },
  h1: { fontSize: 24, fontWeight: '800', color: colors.navy },
  score: { fontSize: 44, fontWeight: '800', color: colors.tealDark },
  pass: { fontSize: 16, fontWeight: '700', color: colors.success, marginTop: 4 },

  progress: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  dot: { width: 9, height: 9, borderRadius: 50, backgroundColor: colors.line },
  dotDone: { backgroundColor: colors.success },
  dotActive: { backgroundColor: colors.gold, transform: [{ scale: 1.25 }] },
  count: { marginLeft: 'auto', color: colors.muted, fontSize: 13, fontWeight: '700' },

  label: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    letterSpacing: 1, marginBottom: 10,
  },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  prompt: { fontSize: 26, fontWeight: '800', color: colors.navy, marginBottom: 14 },
  promptSema: { fontSize: 30, fontWeight: '800', color: colors.navy },
  gloss: { color: colors.muted, fontSize: 15, marginTop: 4, marginBottom: 16 },

  option: {
    borderWidth: 1.5, borderColor: colors.line, borderRadius: 10,
    paddingVertical: 13, paddingHorizontal: 16, marginBottom: 10, backgroundColor: '#fff',
  },
  optionSelected: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  optionRight: { borderColor: colors.success, backgroundColor: colors.successTint },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  optionDim: { opacity: 0.5 },
  optionText: { fontSize: 16, color: colors.ink, fontWeight: '600' },

  feedback: { marginTop: 18, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  strengthLbl: { fontSize: 10, fontWeight: '800', color: colors.muted, letterSpacing: 1 },
  strengthTrack: {
    flex: 1, height: 8, backgroundColor: colors.light, borderRadius: 999, overflow: 'hidden',
  },
  strengthFill: { height: '100%', backgroundColor: colors.teal, borderRadius: 999 },
  strengthPct: { fontSize: 13, fontWeight: '800', color: colors.tealDark, minWidth: 36, textAlign: 'right' },
  when: { fontSize: 13, marginTop: 8 },

  mic: {
    alignSelf: 'flex-start', backgroundColor: colors.teal, borderRadius: radius,
    paddingVertical: 13, paddingHorizontal: 22, ...shadow,
  },
  micRec: { backgroundColor: colors.danger },
  micText: { color: '#fff', fontWeight: '700', fontSize: 15.5 },
  semaResult: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 16 },
  semaScore: { fontSize: 34, fontWeight: '800' },
  note: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  err: { color: colors.danger, fontSize: 13.5, marginTop: 10 },

  // The bonus proverb, set apart from the drill items so it reads as a gift.
  methali: { alignItems: 'center', paddingVertical: 6 },
  methaliRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  methaliText: { fontSize: 22, fontWeight: '800', color: colors.navy, textAlign: 'center', lineHeight: 30 },
  methaliGloss: { color: colors.tealDark, fontSize: 15.5, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  methaliNote: {
    color: colors.muted, fontSize: 13.5, lineHeight: 20, marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.line, textAlign: 'center',
  },

  xpTotal: { marginTop: 14, fontWeight: '800', color: colors.gold, fontSize: 15.5 },
  milestone: {
    alignSelf: 'stretch', marginTop: 16, padding: 14, borderRadius: radius,
    backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.goldLight,
  },
  milestoneTitle: { fontWeight: '800', color: colors.gold, fontSize: 15.5 },
  milestoneDetail: { color: colors.muted, fontSize: 13.5, lineHeight: 19, marginTop: 4 },

  streak: {
    alignSelf: 'stretch', marginTop: 18, padding: 16, borderRadius: radius,
    backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center',
  },
  streakNum: { fontSize: 30, fontWeight: '800', color: colors.gold },
  streakLbl: { fontSize: 11, fontWeight: '800', color: colors.muted, letterSpacing: 1.2, marginTop: 4 },
  // A forgiven miss is stated, never quietly absorbed.
  rest: {
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line,
    color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center',
  },

  summary: { alignSelf: 'stretch', marginTop: 16, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  summaryWord: { fontWeight: '700', color: colors.navy, minWidth: 90 },

  foot: { textAlign: 'center', color: colors.muted, fontSize: 13, marginTop: 16 },
});
