import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { colors, shadow } from '../theme';
import { API_BASE_URL } from '../config';
import SpeakButton from './SpeakButton';

// Speak-and-check pronunciation drill (mobile). Records with expo-audio, uploads
// to the backend, which transcribes via the self-hosted Whisper sidecar and
// scores the word match. Degrades to hear-only when the service/mic isn't available.

const DEFAULT_PROMPTS = [
  { swahili: 'Habari yako?', english: 'How are you?' },
  { swahili: 'Ninasoma Kiswahili', english: 'I am learning Swahili' },
  { swahili: 'Asante sana', english: 'Thank you very much' },
];

const scoreColor = (s) => (s >= 80 ? colors.success : s >= 55 ? colors.gold : colors.danger);

export default function PronunciationDrill({ block = {} }) {
  const prompts = block.prompts?.length ? block.prompts : DEFAULT_PROMPTS;
  const [pi, setPi] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | recording | checking | result | error
  const [result, setResult] = useState(null);
  const [enabled, setEnabled] = useState(null);
  const [err, setErr] = useState(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const enabledRef = useRef(null);
  const p = prompts[pi];

  useEffect(() => {
    if (enabledRef.current) { setEnabled(enabledRef.current); return; }
    fetch(`${API_BASE_URL}/api/speech/status`)
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((j) => { enabledRef.current = !!j.enabled; setEnabled(!!j.enabled); })
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => { setPhase('idle'); setResult(null); setErr(null); }, [pi]);

  const startRec = async () => {
    setErr(null);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { setErr('Microphone permission is needed to practice speaking.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setResult(null);
      setPhase('recording');
    } catch {
      setErr('Could not start recording on this device.');
    }
  };

  const stopRec = async () => {
    setPhase('checking');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const form = new FormData();
      form.append('file', { uri, name: 'take.m4a', type: 'audio/m4a' });
      form.append('referenceText', p.swahili);
      const res = await fetch(`${API_BASE_URL}/api/speech/assess`, { method: 'POST', body: form });
      if (!res.ok) throw new Error('assess failed');
      setResult(await res.json());
      setPhase('result');
    } catch {
      setPhase('error');
    }
  };

  const next = () => setPi((i) => (i + 1 < prompts.length ? i + 1 : 0));
  const unavailable = enabled === false;

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Text style={styles.title}>{block.calloutTitle || 'Say it out loud'}</Text>
        <Text style={styles.intro}>
          {block.intro || "Tap 🔊 to hear it, then press the mic and say the phrase. We'll check what you said."}
        </Text>

        <View style={styles.progress}>
          {prompts.map((_, i) => (
            <View key={i} style={[styles.dot, i < pi && styles.dotDone, i === pi && styles.dotActive]} />
          ))}
          <Text style={styles.count}>{pi + 1} / {prompts.length}</Text>
        </View>

        <View style={styles.phrase}>
          <View style={styles.swRow}>
            <Text style={styles.sw}>{p.swahili}</Text>
            <SpeakButton text={p.swahili} />
          </View>
          <Text style={styles.en}>{p.english}</Text>
        </View>

        {unavailable ? (
          <Text style={styles.note}>
            Speak-and-check needs the pronunciation service running. You can still tap 🔊 to hear the phrase.
          </Text>
        ) : (
          <>
            <View style={styles.controls}>
              <Pressable
                onPress={phase === 'recording' ? stopRec : startRec}
                disabled={phase === 'checking'}
                style={[styles.mic, phase === 'recording' && styles.micRec, phase === 'checking' && styles.micBusy]}
              >
                <Text style={styles.micText}>
                  {phase === 'recording' ? '■ Stop' : phase === 'checking' ? 'Checking…' : '🎤 Speak'}
                </Text>
              </Pressable>
              {phase === 'recording' && <Text style={styles.live}>● Listening…</Text>}
            </View>
            {err && <Text style={styles.err}>{err}</Text>}

            {phase === 'result' && result && (
              <View style={styles.result}>
                <View style={[styles.scoreBadge, { backgroundColor: scoreColor(result.score) }]}>
                  <Text style={styles.scoreNum}>{result.score}%</Text>
                  <Text style={styles.scoreLbl}>match</Text>
                </View>
                <View style={styles.detail}>
                  {result.words?.length > 0 && (
                    <View style={styles.target}>
                      {result.words.map((w, i) => (
                        <Text key={i} style={[styles.word, w.ok ? styles.wordOk : styles.wordMiss]}>{w.word}</Text>
                      ))}
                    </View>
                  )}
                  <Text style={styles.heard}>You said: “{result.transcription || '—'}”</Text>
                  <View style={styles.actions}>
                    <Pressable onPress={() => { setPhase('idle'); setResult(null); }} style={styles.ghostBtn}>
                      <Text style={styles.ghostText}>Try again</Text>
                    </Pressable>
                    <Pressable onPress={next} style={styles.goldBtn}>
                      <Text style={styles.goldText}>{pi + 1 < prompts.length ? 'Next →' : 'Start over'}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {phase === 'error' && (
              <Text style={styles.err}>Couldn't reach the pronunciation service. Try again.</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 20 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderLeftWidth: 5, borderLeftColor: colors.gold, borderRadius: 12, padding: 18, ...shadow },
  title: { fontWeight: '800', color: colors.navy, fontSize: 17, marginBottom: 6 },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.line },
  dotDone: { backgroundColor: colors.success },
  dotActive: { backgroundColor: colors.gold, transform: [{ scale: 1.25 }] },
  count: { marginLeft: 'auto', color: colors.muted, fontSize: 12, fontWeight: '700' },
  phrase: { backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, marginBottom: 14 },
  swRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sw: { fontSize: 22, fontWeight: '800', color: colors.navy },
  en: { color: colors.muted, marginTop: 4, fontSize: 14 },
  note: { backgroundColor: colors.light, borderRadius: 10, padding: 12, color: colors.muted, fontSize: 13.5 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  mic: { backgroundColor: colors.teal, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999, ...shadow },
  micRec: { backgroundColor: colors.danger },
  micBusy: { opacity: 0.6 },
  micText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  live: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  err: { color: colors.danger, fontWeight: '600', fontSize: 13, marginTop: 10 },
  result: { flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line, flexWrap: 'wrap' },
  scoreBadge: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { color: '#fff', fontSize: 22, fontWeight: '800' },
  scoreLbl: { color: '#fff', fontSize: 11, textTransform: 'uppercase', opacity: 0.9 },
  detail: { flex: 1, minWidth: 180 },
  target: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  word: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8, fontWeight: '700', fontSize: 14, overflow: 'hidden' },
  wordOk: { backgroundColor: '#e4f4ea', color: colors.success },
  wordMiss: { backgroundColor: '#fdecea', color: colors.danger, textDecorationLine: 'line-through' },
  heard: { color: colors.ink, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  ghostBtn: { borderWidth: 1.5, borderColor: colors.teal, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  ghostText: { color: colors.tealDark, fontWeight: '700' },
  goldBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16 },
  goldText: { color: '#fff', fontWeight: '800' },
});
