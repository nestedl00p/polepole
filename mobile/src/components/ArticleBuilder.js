import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, shadow } from '../theme';
import { speakSwahili } from '../lib/speak';

// English article builder — a / an / the. Swahili has no articles, so this is
// the biggest hurdle for a Swahili-speaking learner. The rule follows the SOUND
// the noun starts with, not the letter.

const NOUNS = [
  { word: 'book', sw: 'kitabu', a: 'a', why: 'Inaanza na sauti ya konsonanti (b).' },
  { word: 'apple', sw: 'tufaha', a: 'an', why: 'Inaanza na sauti ya vokali (a).' },
  { word: 'house', sw: 'nyumba', a: 'a', why: 'Inaanza na sauti ya konsonanti (h).' },
  { word: 'egg', sw: 'yai', a: 'an', why: 'Inaanza na sauti ya vokali (e).' },
  { word: 'orange', sw: 'chungwa', a: 'an', why: 'Inaanza na sauti ya vokali (o).' },
  { word: 'car', sw: 'gari', a: 'a', why: 'Inaanza na sauti ya konsonanti (k).' },
  { word: 'umbrella', sw: 'mwavuli', a: 'an', why: 'Inaanza na sauti ya vokali (u).' },
  { word: 'hour', sw: 'saa', a: 'an', why: 'Herufi "h" haisikiki — inasikika kama "aua".' },
  { word: 'university', sw: 'chuo kikuu', a: 'a', why: 'Inasikika kama "yunivesiti" — sauti ya "y".' },
];

const FORMS = [
  { id: 'a', label: 'a / an', sw: 'kitu chochote' },
  { id: 'the', label: 'the', sw: 'kitu maalum' },
];

export default function ArticleBuilder({ block = {} }) {
  const nouns = block.nouns || NOUNS;
  const [ni, setNi] = useState(0);
  const [fi, setFi] = useState(0);

  const noun = nouns[ni];
  const definite = FORMS[fi].id === 'the';
  const article = definite ? 'the' : noun.a;
  const phrase = `${article} ${noun.word}`;

  const steps = [
    { accent: colors.navy, label: '1 · Chagua nomino', options: nouns.map((n) => ({ a: n.word, b: n.sw })), index: ni, set: setNi },
    { accent: colors.teal, label: '2 · Maalum au la?', options: FORMS.map((f) => ({ a: f.label, b: f.sw })), index: fi, set: setFi },
  ];

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Text style={styles.title}>{block.calloutTitle || 'Jenga: a / an / the'}</Text>
        <Text style={styles.intro}>
          {block.intro ||
            'Kiswahili hakina "a", "an" wala "the" — lakini Kiingereza kinahitaji. Tumia "a/an" kwa kitu chochote, na "the" kwa kitu maalum.'}
        </Text>

        {steps.map((step, idx) => (
          <View style={styles.step} key={idx}>
            <View style={styles.stepLabel}>
              <View style={[styles.dot, { backgroundColor: step.accent }]} />
              <Text style={styles.stepLabelText}>{step.label}</Text>
            </View>
            <View style={styles.pills}>
              {step.options.map((o, i) => {
                const active = i === step.index;
                return (
                  <Pressable key={o.a} onPress={() => step.set(i)}
                    style={[styles.pill, active && { borderColor: step.accent, backgroundColor: step.accent }]}>
                    <Text style={[styles.pillSw, active && styles.pillActiveText]}>{o.a}</Text>
                    <Text style={[styles.pillEn, active && styles.pillActiveText]}>{o.b}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.formula}>
          <View style={[styles.piece, { backgroundColor: colors.gold }]}>
            <Text style={styles.pieceTag}>{definite ? 'maalum' : 'si maalum'}</Text>
            <Text style={styles.pieceVal}>{article}</Text>
          </View>
          <Text style={styles.op}>+</Text>
          <View style={[styles.piece, { backgroundColor: colors.navy }]}>
            <Text style={styles.pieceTag}>nomino</Text>
            <Text style={styles.pieceVal}>{noun.word}</Text>
          </View>
          <Text style={styles.op}>=</Text>
        </View>

        <View style={styles.result}>
          <View style={styles.wordRow}>
            <Text style={styles.word}>
              <Text style={{ color: colors.gold }}>{article}</Text>
              <Text>{' '}</Text>
              <Text style={{ color: colors.navy }}>{noun.word}</Text>
            </Text>
            <Pressable onPress={() => speakSwahili(phrase)} style={styles.speak}
              accessibilityRole="button" accessibilityLabel={`Sikiliza ${phrase}`}>
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
          </View>
          <Text style={styles.en}>“{noun.sw}”</Text>
          <Text style={styles.tip}>
            💡 {definite ? '"the" haibadiliki kamwe — ni sawa kwa kila nomino.' : noun.why}
          </Text>
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
  step: { marginBottom: 14 },
  stepLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  dot: { width: 11, height: 11, borderRadius: 6, marginRight: 8 },
  stepLabelText: { fontWeight: '700', color: colors.ink, fontSize: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { alignItems: 'center', borderWidth: 2, borderColor: colors.line, backgroundColor: '#fff', borderRadius: 11, paddingVertical: 8, paddingHorizontal: 14, minWidth: 60 },
  pillSw: { fontWeight: '800', color: colors.navy, fontSize: 15 },
  pillEn: { fontSize: 11.5, color: colors.muted, fontWeight: '600' },
  pillActiveText: { color: '#fff' },
  formula: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 18, marginBottom: 14 },
  piece: { alignItems: 'center', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 13, minWidth: 58 },
  pieceTag: { fontSize: 9, color: '#fff', fontWeight: '700', letterSpacing: 0.4 },
  pieceVal: { fontSize: 19, color: '#fff', fontWeight: '800' },
  op: { fontSize: 19, fontWeight: '800', color: colors.muted },
  result: { backgroundColor: colors.light, borderRadius: 10, padding: 16, alignItems: 'center' },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  word: { fontSize: 26, fontWeight: '900' },
  speak: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.teal, backgroundColor: '#fff' },
  speakIcon: { fontSize: 18 },
  en: { color: colors.ink, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  tip: { color: colors.muted, fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 19 },
});
