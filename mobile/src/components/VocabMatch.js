import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, shadow } from '../theme';
import { Button } from './ui';
import { speakSwahili } from '../lib/speak';
import { useAuth } from '../context/AuthContext';
import { lessonStrings, shuffled } from '../lib/lessonStrings';

const PAIRS_PER_ROUND = 6;

// Matching game built from the lesson's own vocabulary, so every lesson gets
// one with no extra content. Tap a word, then its meaning; a match is spoken.
// pairs: [{ learning, known }]
export default function VocabMatch({ pairs }) {
  const { user } = useAuth();
  const t = lessonStrings(user?.course);
  const [round, setRound] = useState(0);
  // Keyed on the words themselves so a parent re-render doesn't reshuffle.
  const signature = pairs.map((p) => p.learning).join('|');
  const { left, right } = useMemo(() => {
    // Two words sharing a meaning would make a tile ambiguous — keep one.
    const seenL = new Set();
    const seenK = new Set();
    const unique = shuffled(pairs).filter((p) => {
      if (seenL.has(p.learning) || seenK.has(p.known)) return false;
      seenL.add(p.learning);
      seenK.add(p.known);
      return true;
    });
    const chosen = unique.slice(0, PAIRS_PER_ROUND).map((p, id) => ({ ...p, id }));
    return { left: shuffled(chosen), right: shuffled(chosen) };
  }, [signature, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const [pickL, setPickL] = useState(null);
  const [pickR, setPickR] = useState(null);
  const [matched, setMatched] = useState(() => new Set());
  const [miss, setMiss] = useState(null);   // { l, r } flashing red
  const [misses, setMisses] = useState(0);

  const tryPair = (l, r) => {
    if (l == null || r == null) return;
    if (l === r) {
      setMatched((m) => new Set(m).add(l));
      speakSwahili(left.find((p) => p.id === l).learning);
    } else {
      setMiss({ l, r });
      setMisses((n) => n + 1);
      setTimeout(() => setMiss(null), 550);
    }
    setPickL(null);
    setPickR(null);
  };

  const tapL = (id) => { if (!miss) { setPickL(id); tryPair(id, pickR); } };
  const tapR = (id) => { if (!miss) { setPickR(id); tryPair(pickL, id); } };

  const newRound = () => { setMatched(new Set()); setMisses(0); setPickL(null); setPickR(null); setRound((r) => r + 1); };
  const done = matched.size === left.length;

  const tile = (p, side, picked, onTap) => {
    const isMatched = matched.has(p.id);
    const isMiss = miss && miss[side] === p.id;
    return (
      <Pressable
        key={p.id}
        onPress={() => onTap(p.id)}
        disabled={isMatched}
        accessibilityRole="button"
        accessibilityState={{ selected: picked === p.id, disabled: isMatched }}
        style={[styles.tile, picked === p.id && styles.tilePicked, isMatched && styles.tileMatched, isMiss && styles.tileMiss]}
      >
        <Text style={[styles.tileText, isMatched && { color: '#1d7a43' }]}>{side === 'l' ? p.learning : p.known}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t.matchTitle}</Text>
      <Text style={styles.intro}>{t.matchIntro}</Text>
      <View style={styles.grid}>
        <View style={styles.col}>{left.map((p) => tile(p, 'l', pickL, tapL))}</View>
        <View style={styles.col}>{right.map((p) => tile(p, 'r', pickR, tapR))}</View>
      </View>
      {done && (
        <View style={styles.doneRow}>
          <Text style={styles.doneText}>🎉 {t.matchDone} {t.matchMisses(misses)}</Text>
          <Button title={t.newRound} variant="ghost" size="sm" onPress={newRound} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderLeftWidth: 5, borderLeftColor: colors.navy, borderRadius: 12, padding: 18, ...shadow },
  title: { fontWeight: '800', color: colors.navy, fontSize: 17, marginBottom: 6 },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  grid: { flexDirection: 'row', gap: 10 },
  col: { flex: 1, gap: 8 },
  tile: { minHeight: 48, justifyContent: 'center', borderWidth: 2, borderColor: colors.line, borderRadius: 10, backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 10 },
  tilePicked: { borderColor: colors.gold, backgroundColor: colors.goldTint },
  tileMatched: { borderColor: colors.success, backgroundColor: colors.successTint },
  tileMiss: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  tileText: { color: colors.ink, fontWeight: '700', fontSize: 14.5, textAlign: 'center' },
  doneRow: { marginTop: 14, gap: 10, alignItems: 'flex-start' },
  doneText: { color: colors.success, fontWeight: '800' },
});
