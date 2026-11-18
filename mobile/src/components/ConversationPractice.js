import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { colors, shadow } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { lessonStrings } from '../lib/lessonStrings';
import { speakSwahili, stopSpeaking } from '../lib/speak';
import SpeakButton from './SpeakButton';

// Conversation practice (mobile): a spoken role-play with an AI partner. The
// learner reads the scene, hears the partner's opening line, then answers out
// loud — each turn goes to /api/conversation/turn, which transcribes the
// recording, asks the model for the partner's reply, and returns it.
//
// The transcript lives here and is sent with every turn, so the server keeps
// nothing: "that's not what I said" just drops the last exchange.
//
// Replies are spoken through speak.js (the /api/tts clip the server has just
// cached, else the device voice) rather than the base64 audio in the response,
// which expo-audio cannot play without writing it to a file first.

export default function ConversationPractice({ block = {}, lessonId }) {
  const { user } = useAuth();
  const t = lessonStrings(user?.course);
  const scenario = block.scenario || {};
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [status, setStatus] = useState(null);   // null = unknown
  const [started, setStarted] = useState(false);
  const [turns, setTurns] = useState([]);       // [{ role, text, translation?, feedback?, spoken? }]
  const [phase, setPhase] = useState('idle');   // idle | recording | thinking
  const [notice, setNotice] = useState(null);
  const [micErr, setMicErr] = useState(null);
  const [done, setDone] = useState(false);
  const [typed, setTyped] = useState('');
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    api.conversationStatus().then(setStatus).catch(() => setStatus({ enabled: false }));
    return () => stopSpeaking();
  }, []);

  const opening = { role: 'partner', text: scenario.opening, translation: scenario.openingTranslation };

  const start = () => {
    setTurns([]); setDone(false); setNotice(null); setMicErr(null); setTyped(''); setStarted(true);
    speakSwahili(opening.text);
  };

  const send = async ({ uri, text }) => {
    setNotice(null);
    setPhase('thinking');
    try {
      const form = new FormData();
      form.append('lessonId', String(lessonId));
      form.append('history', JSON.stringify(turns.map(({ role, text: line }) => ({ role, text: line }))));
      if (uri) form.append('file', { uri, name: 'turn.m4a', type: 'audio/m4a' });
      else form.append('text', text);

      const r = await api.conversationTurn(form);
      if (typeof r.turnsLeft === 'number') setStatus((s) => ({ ...s, turnsLeft: r.turnsLeft }));

      if (r.unclear) {
        setNotice(t.cvUnclear);
      } else {
        setTurns((prev) => [
          ...prev,
          { role: 'learner', text: r.heard, feedback: r.feedback, spoken: !!uri },
          { role: 'partner', text: r.reply, translation: r.translation },
        ]);
        setDone(!!r.done);
        setTyped('');
        speakSwahili(r.reply);
      }
    } catch (err) {
      setNotice(err.status === 429 || err.status === 503 ? err.message : t.cvError);
    } finally {
      setPhase('idle');
    }
  };

  const onMic = async () => {
    if (phase === 'recording') {
      setPhase('thinking');
      try {
        await recorder.stop();
        // Leave recording mode, or iOS plays the reply through the earpiece.
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      } catch {
        setPhase('idle');
        setMicErr(t.cvMicFailed);
        return;
      }
      if (!recorder.uri) { setPhase('idle'); return; }
      await send({ uri: recorder.uri });
      return;
    }

    stopSpeaking();
    setNotice(null);
    setMicErr(null);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { setMicErr(t.cvMicDenied); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch {
      setMicErr(t.cvMicFailed);
    }
  };

  const onType = () => {
    const text = typed.trim();
    if (text && phase === 'idle') send({ text });
  };

  // The recording was misheard: drop the last exchange so it can be said again.
  const redo = () => {
    setTurns((prev) => prev.slice(0, -2));
    setDone(false);
    setNotice(null);
  };

  const canSpeak = !!status?.speech;
  const outOfTurns = status?.turnsLeft === 0;
  const lastLearner = turns.length >= 2 ? turns.length - 2 : -1;
  const learnerTurns = turns.filter((x) => x.role === 'learner').length;
  const canSend = phase === 'idle' && typed.trim().length > 0;

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Text style={styles.title}>{block.calloutTitle || t.cvTitle}</Text>
        {!!block.intro && <Text style={styles.intro}>{block.intro}</Text>}

        <View style={styles.scene}>
          <Text style={styles.sceneText}>{scenario.setting}</Text>
          <Text style={[styles.sceneText, styles.goal]}>
            <Text style={styles.goalLabel}>{t.cvGoal} </Text>
            {scenario.goal}
          </Text>
        </View>

        {status === null ? null : !status.enabled ? (
          <Text style={styles.note}>{t.cvUnavailable}</Text>
        ) : !started ? (
          <Pressable onPress={start} disabled={outOfTurns} style={[styles.primaryBtn, outOfTurns && styles.disabled]}>
            <Text style={styles.primaryText}>{outOfTurns ? t.cvNoTurns : t.cvStart}</Text>
          </Pressable>
        ) : (
          <>
            <View style={styles.thread}>
              {[opening, ...turns].map((turn, i) => {
                const idx = i - 1; // index into turns; -1 is the opening line
                return turn.role === 'partner' ? (
                  <View key={i} style={[styles.bubble, styles.partner]}>
                    <View style={styles.line}>
                      <Text style={styles.partnerText}>{turn.text}</Text>
                      <SpeakButton text={turn.text} size="sm" />
                    </View>
                    {showHelp && !!turn.translation && <Text style={styles.tr}>{turn.translation}</Text>}
                  </View>
                ) : (
                  <View key={i} style={styles.learnerRow}>
                    <View style={[styles.bubble, styles.learner]}>
                      <Text style={styles.learnerText}>{turn.text}</Text>
                    </View>
                    {!!turn.feedback && <Text style={styles.feedback}>💡 {turn.feedback}</Text>}
                    {idx === lastLearner && turn.spoken && phase === 'idle' && (
                      <Pressable onPress={redo} hitSlop={8}>
                        <Text style={styles.redo}>{t.cvRedo}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
              {phase === 'thinking' && (
                <View style={[styles.bubble, styles.partner]}>
                  <Text style={styles.typing}>…</Text>
                </View>
              )}
            </View>

            {!!notice && <Text style={styles.err}>{notice}</Text>}

            {done ? (
              <View style={styles.doneBox}>
                <Text style={styles.doneText}>🎉 {t.cvDone(learnerTurns)}</Text>
                <Pressable onPress={start} disabled={outOfTurns} style={[styles.goldBtn, outOfTurns && styles.disabled]}>
                  <Text style={styles.goldText}>{t.cvAgain}</Text>
                </Pressable>
              </View>
            ) : outOfTurns ? (
              <Text style={styles.note}>{t.cvNoTurns}</Text>
            ) : (
              <>
                {canSpeak && (
                  <View style={styles.controls}>
                    <Pressable
                      onPress={onMic}
                      disabled={phase === 'thinking'}
                      style={[styles.mic, phase === 'recording' && styles.micRec, phase === 'thinking' && styles.disabled]}
                    >
                      <Text style={styles.micText}>
                        {phase === 'recording' ? t.cvStop : phase === 'thinking' ? t.cvThinking : t.cvSpeak}
                      </Text>
                    </Pressable>
                    {phase === 'recording' && <Text style={styles.live}>● {t.cvListening}</Text>}
                  </View>
                )}
                {!!micErr && <Text style={styles.err}>{micErr}</Text>}

                <View style={styles.typeRow}>
                  <TextInput
                    style={styles.input}
                    value={typed}
                    onChangeText={setTyped}
                    maxLength={300}
                    placeholder={canSpeak ? t.cvOrType : t.cvType}
                    placeholderTextColor={colors.muted}
                    editable={phase === 'idle'}
                    autoCapitalize="sentences"
                    autoCorrect={false}
                    returnKeyType="send"
                    onSubmitEditing={onType}
                    accessibilityLabel={t.cvType}
                  />
                  <Pressable onPress={onType} disabled={!canSend} style={[styles.ghostBtn, !canSend && styles.disabled]}>
                    <Text style={styles.ghostText}>{t.cvSend}</Text>
                  </Pressable>
                </View>
                {status.speech === false && <Text style={styles.hint}>{t.cvTypeOnly}</Text>}
              </>
            )}

            <Pressable onPress={() => setShowHelp((v) => !v)} hitSlop={8} style={styles.toggle}>
              <Text style={styles.toggleText}>{showHelp ? t.cvHideHelp : t.cvShowHelp}</Text>
            </Pressable>
            {showHelp && scenario.phrases?.length > 0 && (
              <View style={styles.phrases}>
                {scenario.phrases.map((p, i) => (
                  <View key={i} style={styles.phrase}>
                    <Text style={styles.phraseSw}>{p.swahili}</Text>
                    <Text style={styles.phraseEn}>{p.english}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 20 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderLeftWidth: 5, borderLeftColor: colors.teal, borderRadius: 12, padding: 18, ...shadow },
  title: { fontWeight: '800', color: colors.navy, fontSize: 17, marginBottom: 6 },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 14 },

  scene: { backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, marginBottom: 14 },
  sceneText: { color: colors.ink, fontSize: 14.5, lineHeight: 22 },
  goal: { marginTop: 8 },
  goalLabel: { fontWeight: '800', color: colors.gold },

  note: { backgroundColor: colors.light, borderRadius: 10, padding: 12, color: colors.muted, fontSize: 13.5, lineHeight: 20 },
  hint: { color: colors.muted, fontSize: 13, marginTop: 8, lineHeight: 19 },
  err: { color: colors.danger, fontWeight: '600', fontSize: 13, marginTop: 10, lineHeight: 19 },
  disabled: { opacity: 0.5 },

  primaryBtn: { backgroundColor: colors.teal, paddingVertical: 13, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', ...shadow },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16, textAlign: 'center' },

  thread: { gap: 10, marginBottom: 4 },
  bubble: { maxWidth: '88%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  partner: { alignSelf: 'flex-start', backgroundColor: colors.light, borderTopLeftRadius: 4 },
  learnerRow: { alignItems: 'flex-end' },
  learner: { backgroundColor: colors.teal, borderTopRightRadius: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  partnerText: { flexShrink: 1, color: colors.navy, fontSize: 16, fontWeight: '700', lineHeight: 23 },
  learnerText: { color: '#fff', fontSize: 16, fontWeight: '600', lineHeight: 23 },
  tr: { color: colors.muted, fontSize: 13.5, marginTop: 4, lineHeight: 19 },
  typing: { color: colors.muted, fontSize: 20, fontWeight: '800', letterSpacing: 2 },
  feedback: { maxWidth: '88%', color: colors.ink, backgroundColor: colors.goldTint, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 11, marginTop: 6, fontSize: 13.5, lineHeight: 20, overflow: 'hidden' },
  redo: { color: colors.tealDark, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline', marginTop: 6 },

  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 },
  mic: { backgroundColor: colors.teal, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999, ...shadow },
  micRec: { backgroundColor: colors.danger },
  micText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  live: { flexShrink: 1, color: colors.danger, fontWeight: '700', fontSize: 13 },

  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  input: { flex: 1, minHeight: 44, borderWidth: 1.5, borderColor: colors.line, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: '#fff' },
  ghostBtn: { minHeight: 44, justifyContent: 'center', borderWidth: 1.5, borderColor: colors.teal, borderRadius: 10, paddingHorizontal: 14 },
  ghostText: { color: colors.tealDark, fontWeight: '700' },

  doneBox: { backgroundColor: colors.successTint, borderRadius: 12, padding: 14, marginTop: 12, gap: 10, alignItems: 'flex-start' },
  doneText: { color: colors.ink, fontWeight: '700', fontSize: 15, lineHeight: 22 },
  goldBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16 },
  goldText: { color: '#fff', fontWeight: '800' },

  toggle: { marginTop: 16, alignSelf: 'flex-start' },
  toggleText: { color: colors.tealDark, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  phrases: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  phrase: { backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  phraseSw: { color: colors.navy, fontWeight: '800', fontSize: 14 },
  phraseEn: { color: colors.muted, fontSize: 12.5, marginTop: 1 },
});
