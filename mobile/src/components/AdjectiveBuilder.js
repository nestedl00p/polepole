import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, shadow } from '../theme';
import { speakSwahili } from '../lib/speak';

// Interactive Swahili adjective-agreement builder: NOUN + agreement-prefix + ADJ.
// N-class sound changes are stored explicitly per adjective (nForm).

const NOUNS = [
  { noun: 'mtu', en: 'person', acord: 'm', cls: 'M/WA' },
  { noun: 'watu', en: 'people', acord: 'wa', cls: 'M/WA pl' },
  { noun: 'mti', en: 'tree', acord: 'm', cls: 'M/MI' },
  { noun: 'miti', en: 'trees', acord: 'mi', cls: 'M/MI pl' },
  { noun: 'kitabu', en: 'book', acord: 'ki', cls: 'KI/VI' },
  { noun: 'vitabu', en: 'books', acord: 'vi', cls: 'KI/VI pl' },
  { noun: 'gari', en: 'car', acord: '', cls: 'JI/MA' },
  { noun: 'magari', en: 'cars', acord: 'ma', cls: 'JI/MA pl' },
  { noun: 'nyumba', en: 'house', acord: 'n', cls: 'N' },
];

const ADJECTIVES = [
  { stem: 'zuri', en: 'nice', nForm: 'nzuri' },
  { stem: 'kubwa', en: 'big', nForm: 'kubwa' },
  { stem: 'dogo', en: 'small', nForm: 'ndogo' },
  { stem: 'refu', en: 'tall', nForm: 'ndefu' },
  { stem: 'baya', en: 'bad', nForm: 'mbaya' },
  { stem: 'zito', en: 'heavy', nForm: 'nzito' },
];

const ROLE_COLOR = { stem: colors.navy, mark: colors.gold, sub: colors.teal };
const ROLE_TEXT = { stem: colors.navy, mark: colors.gold, sub: colors.tealDark };

function agree(acord, adj) {
  if (acord === 'n') return adj.nForm || `n${adj.stem}`;
  if (acord === '') return adj.stem;
  return acord + adj.stem;
}
function splitAgreed(agreed, stem) {
  if (agreed.endsWith(stem) && agreed.length > stem.length) {
    return { pre: agreed.slice(0, agreed.length - stem.length), body: stem };
  }
  return { pre: '', body: agreed };
}

export default function AdjectiveBuilder({ block = {} }) {
  const nouns = block.nouns || NOUNS;
  const adjectives = block.adjectives || ADJECTIVES;

  const [ni, setNi] = useState(4);
  const [ai, setAi] = useState(0);
  const noun = nouns[ni];
  const adj = adjectives[ai];

  const agreed = agree(noun.acord, adj);
  const { pre, body } = splitAgreed(agreed, adj.stem);
  const word = `${noun.noun} ${agreed}`;
  const english = `${adj.en} ${noun.en}`;

  const steps = [
    { accent: 'stem', label: '1 · Which thing?', options: nouns.map((n) => ({ sw: n.noun, en: n.en })), index: ni, set: setNi },
    { accent: 'sub', label: '2 · Describe it', options: adjectives.map((a) => ({ sw: `-${a.stem}`, en: a.en })), index: ai, set: setAi },
  ];

  const pieces = [
    { text: noun.noun, role: 'stem', tag: `noun · ${noun.cls}` },
    { text: pre || '∅', role: 'mark', tag: 'agree' },
    { text: adj.stem, role: 'sub', tag: 'describe' },
  ];

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Text style={styles.title}>{block.calloutTitle || 'Build a description: NOUN + prefix + adjective'}</Text>
        <Text style={styles.intro}>
          {block.intro ||
            'The adjective comes after the noun and echoes its class prefix. Pick a noun and an adjective — watch the gold prefix copy the noun’s class. (N-class nouns blend the sound a little.)'}
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

        <View style={styles.result}>
          <View style={styles.wordRow}>
            <Text style={styles.word}>
              <Text style={{ color: ROLE_TEXT.stem }}>{noun.noun}</Text>
              <Text>{' '}</Text>
              {!!pre && <Text style={{ color: ROLE_TEXT.mark }}>{pre}</Text>}
              <Text style={{ color: ROLE_TEXT.sub }}>{body}</Text>
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
