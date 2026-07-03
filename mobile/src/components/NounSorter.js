import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, shadow } from '../theme';
import { speakSwahili } from '../lib/speak';

// Interactive noun-class explorer. Tap a noun → class, plural, and verb agreement.
// block.mode: 'set1' (M/WA + M/MI) | 'set2' (KI/VI + N).

const SETS = {
  set1: [
    { sing: 'mtu', pl: 'watu', en: 'person', cls: 'M/WA', note: 'people', ex: 'Mtu [a]nacheza · Watu [wa]nacheza', exEn: 'a person plays · people play' },
    { sing: 'mtoto', pl: 'watoto', en: 'child', cls: 'M/WA', note: 'people', ex: 'Mtoto [a]nalala · Watoto [wa]nalala', exEn: 'a child sleeps · children sleep' },
    { sing: 'mti', pl: 'miti', en: 'tree', cls: 'M/MI', note: 'plants & things', ex: 'Mti [u]naanguka · Miti [i]naanguka', exEn: 'a tree falls · trees fall' },
    { sing: 'mlango', pl: 'milango', en: 'door', cls: 'M/MI', note: 'plants & things', ex: 'Mlango [u]nafunguka · Milango [i]nafunguka', exEn: 'a door opens · doors open' },
  ],
  set2: [
    { sing: 'kitabu', pl: 'vitabu', en: 'book', cls: 'KI/VI', note: 'things', ex: 'Kitabu [ki]nasomwa · Vitabu [vi]nasomwa', exEn: 'a book is read · books are read' },
    { sing: 'kiti', pl: 'viti', en: 'chair', cls: 'KI/VI', note: 'things', ex: 'Kiti [ki]mevunjika · Viti [vi]mevunjika', exEn: 'a chair is broken · chairs are broken' },
    { sing: 'nyumba', pl: 'nyumba', en: 'house', cls: 'N', note: 'same sing & plural', ex: 'Nyumba [i]najengwa · Nyumba [zi]najengwa', exEn: 'a house is built · houses are built' },
    { sing: 'simu', pl: 'simu', en: 'phone', cls: 'N', note: 'same sing & plural', ex: 'Simu [i]nalia · Simu [zi]nalia', exEn: 'a phone rings · phones ring' },
  ],
};

function segments(ex) {
  return ex.split(/(\[[^\]]*\])/).filter(Boolean).map((part) =>
    part.startsWith('[') && part.endsWith(']') ? { text: part.slice(1, -1), hl: true } : { text: part, hl: false }
  );
}

export default function NounSorter({ block = {} }) {
  const nouns = block.nouns || SETS[block.mode] || SETS.set1;
  const [i, setI] = useState(0);
  const n = nouns[i];

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Text style={styles.title}>{block.calloutTitle || 'Sort the noun'}</Text>
        {!!block.intro && <Text style={styles.intro}>{block.intro}</Text>}

        <View style={styles.step}>
          <View style={styles.stepLabel}>
            <View style={[styles.dot, { backgroundColor: colors.navy }]} />
            <Text style={styles.stepLabelText}>Tap a noun</Text>
          </View>
          <View style={styles.pills}>
            {nouns.map((item, idx) => {
              const active = idx === i;
              return (
                <Pressable key={item.sing} onPress={() => setI(idx)} style={[styles.pill, active && { borderColor: colors.navy, backgroundColor: colors.navy }]}>
                  <Text style={[styles.pillSw, active && styles.pillActiveText]}>{item.sing}</Text>
                  <Text style={[styles.pillEn, active && styles.pillActiveText]}>{item.en}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.result}>
          <Text style={styles.badge}>{n.cls} · {n.note}</Text>
          <View style={styles.wordRow}>
            <Text style={styles.word}>
              <Text style={{ color: colors.navy }}>{n.sing}</Text>
              <Text style={{ color: colors.muted }}>{'  →  '}</Text>
              <Text style={{ color: colors.navy }}>{n.pl}</Text>
            </Text>
            <Pressable onPress={() => speakSwahili(`${n.sing}, ${n.pl}`)} style={styles.speak} accessibilityRole="button" accessibilityLabel={`Hear ${n.sing}, ${n.pl}`}>
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
          </View>
          <Text style={styles.verb}>
            {segments(n.ex).map((s, k) => (
              <Text key={k} style={s.hl ? { color: colors.gold, fontWeight: '800' } : undefined}>{s.text}</Text>
            ))}
          </Text>
          <Text style={styles.exEn}>{n.exEn}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 20 },
  card: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line,
    borderLeftWidth: 5, borderLeftColor: colors.teal, borderRadius: 12, padding: 18, ...shadow,
  },
  title: { fontWeight: '800', color: colors.navy, fontSize: 17, marginBottom: 6 },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  step: { marginBottom: 14 },
  stepLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  dot: { width: 11, height: 11, borderRadius: 6, marginRight: 8 },
  stepLabelText: { fontWeight: '700', color: colors.ink, fontSize: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    alignItems: 'center', borderWidth: 2, borderColor: colors.line, backgroundColor: '#fff',
    borderRadius: 11, paddingVertical: 8, paddingHorizontal: 14, minWidth: 60,
  },
  pillSw: { fontWeight: '800', color: colors.navy, fontSize: 15 },
  pillEn: { fontSize: 11.5, color: colors.muted, fontWeight: '600' },
  pillActiveText: { color: '#fff' },
  result: { backgroundColor: colors.light, borderRadius: 10, padding: 16, alignItems: 'center' },
  badge: { backgroundColor: colors.navy, color: '#fff', fontWeight: '800', fontSize: 12, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, overflow: 'hidden', marginBottom: 12 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  word: { fontSize: 24, fontWeight: '900' },
  speak: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.teal, backgroundColor: '#fff',
  },
  speakIcon: { fontSize: 18 },
  verb: { marginTop: 12, fontSize: 16, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  exEn: { color: colors.muted, fontSize: 13, marginTop: 4, textAlign: 'center' },
});
