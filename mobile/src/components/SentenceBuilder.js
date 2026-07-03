import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { colors, shadow, shadowLg } from '../theme';
import { speakSwahili } from '../lib/speak';
import { Button } from './ui';

// Tap-to-build sentence exercise (mobile equivalent of the web drag-and-drop).
// Tap bank words to place them in order; tap placed words to remove. Check →
// correct: green pop + audio; wrong: shake.

const CHALLENGES = [
  { answer: ['Huyu', 'ni', 'rafiki', 'yangu'], en: 'This is my friend' },
  { answer: ['Ana', 'watoto', 'wawili'], en: 'She has two children' },
  { answer: ['Jina', 'lake', 'ni', 'Asha'], en: 'Her name is Asha' },
  { answer: ['Watoto', 'wake', 'ni', 'wadogo'], en: 'Her children are small' },
  { answer: ['Rafiki', 'yangu', 'ni', 'mwalimu'], en: 'My friend is a teacher' },
];

function scramble(answer) {
  let order;
  do {
    order = [...answer.keys()].sort(() => Math.random() - 0.5);
  } while (answer.length > 1 && order.every((v, i) => answer[v] === answer[i]));
  return order.map((idx, i) => ({ w: answer[idx], k: `${idx}-${i}` }));
}

export default function SentenceBuilder({ block = {} }) {
  const challenges = block.challenges || CHALLENGES;
  const [ci, setCi] = useState(0);
  const [bank, setBank] = useState(() => scramble(challenges[0].answer));
  const [line, setLine] = useState([]);
  const [status, setStatus] = useState('idle');
  const [done, setDone] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const ch = challenges[ci];

  useEffect(() => {
    setBank(scramble(ch.answer));
    setLine([]);
    setStatus('idle');
  }, [ci]); // eslint-disable-line react-hooks/exhaustive-deps

  const place = (tile) => {
    if (status === 'correct') return;
    setBank((b) => b.filter((t) => t.k !== tile.k));
    setLine((l) => [...l, tile]);
    setStatus('idle');
  };
  const unplace = (tile) => {
    if (status === 'correct') return;
    setLine((l) => l.filter((t) => t.k !== tile.k));
    setBank((b) => [...b, tile]);
    setStatus('idle');
  };

  const runShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };
  const runPop = () => {
    pop.setValue(1);
    Animated.sequence([
      Animated.spring(pop, { toValue: 1.12, useNativeDriver: true, friction: 4 }),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
  };

  const check = () => {
    if (status === 'correct') return;
    const correct = line.map((t) => t.w).join(' ') === ch.answer.join(' ');
    if (correct) {
      setStatus('correct');
      runPop();
      speakSwahili(ch.answer.join(' '));
      setTimeout(() => {
        if (ci + 1 >= challenges.length) setDone(true);
        else setCi(ci + 1);
      }, 1900);
    } else {
      setStatus('wrong');
      runShake();
      setTimeout(() => setStatus((s) => (s === 'wrong' ? 'idle' : s)), 700);
    }
  };

  if (done) {
    return (
      <View style={styles.block}>
        <View style={[styles.card, { alignItems: 'center' }]}>
          <Text style={{ fontSize: 44 }}>🎉</Text>
          <Text style={styles.doneTitle}>Hongera! — Well done!</Text>
          <Text style={styles.doneSub}>You built all {challenges.length} sentences.</Text>
          <Button title="Build them again" onPress={() => { setDone(false); setCi(0); }} />
        </View>
      </View>
    );
  }

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] });
  const lineBorder = status === 'correct' ? colors.success : status === 'wrong' ? colors.danger : colors.line;
  const lineBg = status === 'correct' ? colors.successTint : colors.cream;

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Text style={styles.title}>{block.calloutTitle || 'Build the sentence'}</Text>
        <Text style={styles.intro}>{block.intro || 'Tap the words into the right order, then Check. Get it right to hear it spoken.'}</Text>

        <View style={styles.progress}>
          {challenges.map((_, i) => (
            <View key={i} style={[styles.dot, i < ci && styles.dotDone, i === ci && styles.dotActive]} />
          ))}
          <Text style={styles.count}>{ci + 1} / {challenges.length}</Text>
        </View>

        <Text style={styles.prompt}>Say: <Text style={{ fontWeight: '800', color: colors.navy }}>“{ch.en}”</Text></Text>

        <Animated.View style={[styles.line, { borderColor: lineBorder, backgroundColor: lineBg, transform: [{ translateX }, { scale: pop }] }]}>
          {line.length === 0 && <Text style={styles.linePlaceholder}>Tap words below…</Text>}
          {line.map((t) => (
            <Pressable key={t.k} onPress={() => unplace(t)} style={[styles.tile, status === 'correct' && styles.tileCorrect]}>
              <Text style={[styles.tileText, status === 'correct' && { color: '#fff' }]}>{t.w}</Text>
            </Pressable>
          ))}
        </Animated.View>

        <View style={styles.bank}>
          {bank.map((t) => (
            <Pressable key={t.k} onPress={() => place(t)} style={styles.tile}>
              <Text style={styles.tileText}>{t.w}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Button title="Check ✓" variant="gold" onPress={check} disabled={line.length === 0 || status === 'correct'} />
          {status === 'wrong' && <Text style={styles.msgWrong}>Not quite — try again</Text>}
          {status === 'correct' && <Text style={styles.msgCorrect}>✓ Sawa!</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 20 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderLeftWidth: 5, borderLeftColor: colors.gold, borderRadius: 12, padding: 18, ...shadow },
  title: { fontWeight: '800', color: colors.navy, fontSize: 17, marginBottom: 6 },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.line },
  dotDone: { backgroundColor: colors.success },
  dotActive: { backgroundColor: colors.gold, transform: [{ scale: 1.25 }] },
  count: { marginLeft: 'auto', color: colors.muted, fontSize: 12, fontWeight: '700' },
  prompt: { color: colors.ink, fontSize: 15.5, marginBottom: 12 },
  line: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, minHeight: 60, padding: 12, borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, alignItems: 'center' },
  linePlaceholder: { color: colors.muted, fontStyle: 'italic' },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  tile: { backgroundColor: '#fff', borderWidth: 2, borderColor: colors.teal, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 15, ...shadowLg },
  tileCorrect: { backgroundColor: colors.success, borderColor: colors.success },
  tileText: { fontWeight: '800', color: colors.navy, fontSize: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' },
  msgWrong: { color: colors.danger, fontWeight: '800' },
  msgCorrect: { color: colors.success, fontWeight: '800' },
  doneTitle: { fontSize: 20, fontWeight: '900', color: colors.navy, marginTop: 6 },
  doneSub: { color: colors.muted, marginVertical: 8, textAlign: 'center' },
});
