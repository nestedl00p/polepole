import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, shadow } from '../theme';
import { speakSwahili } from '../lib/speak';

// Interactive Swahili possessive builder: NOUN + link(agreement) + STEM.
// The stem (whose) is constant; the link changes with the noun's class.

const NOUNS = [
  { noun: 'mtoto', en: 'child', concord: 'w', cls: 'M/WA' },
  { noun: 'watoto', en: 'children', concord: 'w', cls: 'M/WA pl' },
  { noun: 'mti', en: 'tree', concord: 'w', cls: 'M/MI' },
  { noun: 'miti', en: 'trees', concord: 'y', cls: 'M/MI pl' },
  { noun: 'kitabu', en: 'book', concord: 'ch', cls: 'KI/VI' },
  { noun: 'vitabu', en: 'books', concord: 'vy', cls: 'KI/VI pl' },
  { noun: 'gari', en: 'car', concord: 'l', cls: 'JI/MA' },
  { noun: 'magari', en: 'cars', concord: 'y', cls: 'JI/MA pl' },
  { noun: 'rafiki', en: 'friend', concord: 'y', cls: 'N' },
  { noun: 'nyumba', en: 'house', concord: 'y', cls: 'N' },
  { noun: 'ndizi', en: 'bananas', concord: 'z', cls: 'N pl' },
  { noun: 'uso', en: 'face', concord: 'w', cls: 'U' },
];

const POSSESSORS = [
  { stem: 'angu', en: 'my' },
  { stem: 'ako', en: 'your' },
  { stem: 'ake', en: 'his / her' },
  { stem: 'etu', en: 'our' },
  { stem: 'enu', en: 'your (pl)' },
  { stem: 'ao', en: 'their' },
];

const ROLE_COLOR = { stem: colors.navy, mark: colors.gold, sub: colors.teal };
const ROLE_TEXT = { stem: colors.navy, mark: colors.gold, sub: colors.tealDark };

export default function PossessiveBuilder({ block = {} }) {
  const nouns = block.nouns || NOUNS;
  const possessors = block.possessors || POSSESSORS;

  const [ni, setNi] = useState(4);
  const [pi, setPi] = useState(0);
  const noun = nouns[ni];
  const poss = possessors[pi];

  const word = `${noun.noun} ${noun.concord}${poss.stem}`;
  const english = `${poss.en} ${noun.en}`;

  const steps = [
    { accent: 'stem', label: '1 · Which thing?', options: nouns.map((n) => ({ sw: n.noun, en: n.en })), index: ni, set: setNi },
    { accent: 'sub', label: '2 · Whose is it?', options: possessors.map((p) => ({ sw: `-${p.stem}`, en: p.en })), index: pi, set: setPi },
  ];

  const pieces = [
    { text: noun.noun, role: 'stem', tag: `noun · ${noun.cls}` },
    { text: noun.concord, role: 'mark', tag: 'link' },
    { text: poss.stem, role: 'sub', tag: 'whose' },
  ];

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Text style={styles.title}>{block.calloutTitle || 'Build a possessive: NOUN + link + stem'}</Text>
        <Text style={styles.intro}>
          {block.intro ||
            'A possessive has two parts: a stem that says whose it is, and a “link” that agrees with the noun’s class. The stem never changes — only the link does.'}
        </Text>

        {steps.map((step, idx) => (
          <View style={styles.step} key={idx}>
            <View style={styles.stepLabel}>
              <View style={[styles.dot, { backgroundColor: ROLE_COLOR[step.accent] }]} />
              <Text style={styles.stepLabelText}>{step.label}</Text>
            </View>
            <View style={styles.pills}>
              {step.options.map((o, i) => {
                const active = i === step.index;
                return (
                  <Pressable
                    key={o.sw}
                    onPress={() => step.set(i)}
                    style={[styles.pill, active && { borderColor: ROLE_COLOR[step.accent], backgroundColor: ROLE_COLOR[step.accent] }]}
                  >
                    <Text style={[styles.pillSw, active && styles.pillActiveText]}>{o.sw}</Text>
                    <Text style={[styles.pillEn, active && styles.pillActiveText]}>{o.en}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {/* Live formula */}
        <View style={styles.formula}>
          {pieces.map((p, i) => (
            <View key={i} style={styles.frag}>
              {i > 0 && <Text style={styles.op}>+</Text>}
              <View style={[styles.piece, { backgroundColor: ROLE_COLOR[p.role] }]}>
                <Text style={styles.pieceTag}>{p.tag}</Text>
                <Text style={styles.pieceVal}>{p.text}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.op}>=</Text>
        </View>

        {/* Result */}
        <View style={styles.result}>
          <View style={styles.wordRow}>
            <Text style={styles.word}>
              <Text style={{ color: ROLE_TEXT.stem }}>{noun.noun}</Text>
              <Text>{' '}</Text>
              <Text style={{ color: ROLE_TEXT.mark }}>{noun.concord}</Text>
              <Text style={{ color: ROLE_TEXT.sub }}>{poss.stem}</Text>
            </Text>
            <Pressable onPress={() => speakSwahili(word)} style={styles.speak} accessibilityRole="button" accessibilityLabel={`Hear ${word} spoken`}>
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
          </View>
          <Text style={styles.en}>“{english}”</Text>
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
  formula: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 18, marginBottom: 14 },
  frag: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  piece: { alignItems: 'center', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 13, minWidth: 58 },
  pieceTag: { fontSize: 9, color: '#fff', fontWeight: '700', letterSpacing: 0.4 },
  pieceVal: { fontSize: 19, color: '#fff', fontWeight: '800' },
  op: { fontSize: 19, fontWeight: '800', color: colors.muted },
  result: { backgroundColor: colors.light, borderRadius: 10, padding: 16, alignItems: 'center' },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  speak: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.teal, backgroundColor: '#fff',
  },
  speakIcon: { fontSize: 18 },
  word: { fontSize: 26, fontWeight: '900' },
  en: { color: colors.ink, fontWeight: '700', marginTop: 6, textAlign: 'center' },
});
