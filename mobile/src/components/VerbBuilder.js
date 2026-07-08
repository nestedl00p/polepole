import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, shadow } from '../theme';
import { speakSwahili } from '../lib/speak';

// Interactive Swahili word-builder for grammar "formulas".
// Driven by block.mode: tense | negative | subjunctive | object.
// Verb forms live in one dictionary; each lesson passes a curated, tense-safe
// stemKeys list so the builder never assembles an irregular form.

const STEM_LIB = {
  soma:   { en: 'read',   en3: 'reads',   ing: 'reading',    past: 'read',      pp: 'read' },
  penda:  { en: 'like',   en3: 'likes',   ing: 'liking',     past: 'liked',     pp: 'liked' },
  kula:   { en: 'eat',    en3: 'eats',    ing: 'eating',     past: 'ate',       pp: 'eaten' },
  kunywa: { en: 'drink',  en3: 'drinks',  ing: 'drinking',   past: 'drank',     pp: 'drunk' },
  enda:   { en: 'go',     en3: 'goes',    ing: 'going',      past: 'went',      pp: 'gone' },
  sema:   { en: 'speak',  en3: 'speaks',  ing: 'speaking',   past: 'spoke',     pp: 'spoken' },
  taka:   { en: 'want',   en3: 'wants',   ing: 'wanting',    past: 'wanted',    pp: 'wanted' },
  jua:    { en: 'know',   en3: 'knows',   ing: 'knowing',    past: 'knew',      pp: 'known' },
  ona:    { en: 'see',    en3: 'sees',    ing: 'seeing',     past: 'saw',       pp: 'seen' },
  fanya:  { en: 'do',     en3: 'does',    ing: 'doing',      past: 'did',       pp: 'done' },
  andika: { en: 'write',  en3: 'writes',  ing: 'writing',    past: 'wrote',     pp: 'written' },
  safiri: { en: 'travel', en3: 'travels', ing: 'travelling', past: 'travelled', pp: 'travelled' },
};

const SUBJECTS = [
  { prefix: 'ni', pronoun: 'I', third: false },
  { prefix: 'u', pronoun: 'You', third: false },
  { prefix: 'a', pronoun: 'He / She', third: true },
  { prefix: 'tu', pronoun: 'We', third: false },
  { prefix: 'm', pronoun: 'You all', third: false },
  { prefix: 'wa', pronoun: 'They', third: false },
];

const NEG_SUBJECTS = [
  { prefix: 'si', pronoun: 'I', third: false },
  { prefix: 'hu', pronoun: 'You', third: false },
  { prefix: 'ha', pronoun: 'He / She', third: true },
  { prefix: 'hatu', pronoun: 'We', third: false },
  { prefix: 'ham', pronoun: 'You all', third: false },
  { prefix: 'hawa', pronoun: 'They', third: false },
];

const OBJECTS = [
  { infix: 'ni', en: 'me' },
  { infix: 'ku', en: 'you' },
  { infix: 'm', en: 'him / her' },
  { infix: 'tu', en: 'us' },
  { infix: 'wa', en: 'them' },
];

const TENSE_TAG = { present: 'now', past: 'then', future: 'will', perfect: 'done' };
const DEFAULT_MARKER = { present: 'na', past: 'li', future: 'ta', perfect: 'me' };

const ROLE_COLOR = {
  sub: colors.teal,
  mark: colors.gold,
  stem: colors.navy,
  neg: colors.danger,
  obj: colors.success,
};
const ROLE_TEXT = {
  sub: colors.tealDark,
  mark: colors.gold,
  stem: colors.navy,
  neg: colors.danger,
  obj: colors.success,
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const root = (stem) => stem.replace(/a$/, '');

export default function VerbBuilder({ block = {} }) {
  const mode = block.mode || 'tense';
  const tense = block.tense || 'present';
  const marker = block.marker || DEFAULT_MARKER[tense] || 'na';

  const stemKeys = block.stemKeys ||
    (mode === 'negative' || mode === 'subjunctive'
      ? ['soma', 'penda', 'sema', 'ona', 'taka', 'jua']
      : ['soma', 'penda', 'kula', 'kunywa', 'enda', 'sema']);
  const stems = stemKeys.map((k) => ({ stem: k, ...STEM_LIB[k] }));
  const subjectList = mode === 'negative' ? NEG_SUBJECTS : SUBJECTS;

  const [si, setSi] = useState(0);
  const [vi, setVi] = useState(0);
  const [oi, setOi] = useState(1);

  const subj = subjectList[si];
  const verb = stems[vi];
  const obj = OBJECTS[oi];

  let pieces;
  let english;
  let englishAlt = null;

  if (mode === 'negative') {
    const form = root(verb.stem) + 'i';
    pieces = [
      { text: subj.prefix, role: 'neg', tag: 'not' },
      { text: form, role: 'stem', tag: 'verb · -a→-i' },
    ];
    english = `${subj.pronoun} ${subj.third ? "doesn't" : "don't"} ${verb.en}`;
  } else if (mode === 'subjunctive') {
    const form = root(verb.stem) + 'e';
    pieces = [
      { text: subj.prefix, role: 'sub', tag: 'who' },
      { text: form, role: 'stem', tag: 'verb · -a→-e' },
    ];
    english = subj.prefix === 'tu' ? `let's ${verb.en}` : `${subj.pronoun} should ${verb.en}`;
  } else if (mode === 'object') {
    pieces = [
      { text: subj.prefix, role: 'sub', tag: 'subject' },
      { text: marker, role: 'mark', tag: TENSE_TAG[tense] },
      { text: obj.infix, role: 'obj', tag: 'object' },
      { text: verb.stem, role: 'stem', tag: 'verb' },
    ];
    english = `${subj.pronoun} ${subj.third ? verb.en3 : verb.en} ${obj.en}`;
  } else {
    pieces = [
      { text: subj.prefix, role: 'sub', tag: 'subject' },
      { text: marker, role: 'mark', tag: TENSE_TAG[tense] },
      { text: verb.stem, role: 'stem', tag: 'action' },
    ];
    if (tense === 'present') {
      english = `${subj.pronoun} ${subj.third ? verb.en3 : verb.en}`;
      const be = subj.third ? 'is' : subj.prefix === 'ni' ? 'am' : 'are';
      englishAlt = `${subj.pronoun} ${be} ${verb.ing}`;
    } else if (tense === 'past') {
      english = `${subj.pronoun} ${verb.past}`;
      const wasWere = subj.prefix === 'ni' || subj.third ? 'was' : 'were';
      englishAlt = `${subj.pronoun} ${wasWere} ${verb.ing}`;
    } else if (tense === 'future') {
      english = `${subj.pronoun} will ${verb.en}`;
    } else if (tense === 'perfect') {
      english = `${subj.pronoun} ${subj.third ? 'has' : 'have'} ${verb.pp}`;
    }
  }

  const word = pieces.map((p) => p.text).join('');

  const subjStep = {
    accent: mode === 'negative' ? 'neg' : 'sub',
    label: mode === 'negative' ? '1 · Who is NOT doing it?' : '1 · Who is doing it?',
    options: subjectList.map((s) => ({ sw: `${s.prefix}-`, en: s.pronoun })),
    index: si, set: setSi,
  };
  const stemStep = {
    accent: 'stem',
    label: `${mode === 'object' ? 3 : 2} · Which verb?`,
    options: stems.map((v) => ({ sw: `-${v.stem}`, en: v.en })),
    index: vi, set: setVi,
  };
  const objStep = mode === 'object'
    ? { accent: 'obj', label: '2 · Who receives it?', options: OBJECTS.map((o) => ({ sw: `-${o.infix}-`, en: o.en })), index: oi, set: setOi }
    : null;
  const steps = mode === 'object' ? [subjStep, objStep, stemStep] : [subjStep, stemStep];

  const accentBorder = mode === 'negative' ? colors.danger : mode === 'object' ? colors.success : colors.teal;

  return (
    <View style={styles.block}>
      <View style={[styles.card, { borderLeftColor: accentBorder }]}>
        <Text style={styles.title}>{block.calloutTitle || 'Build a Swahili word'}</Text>
        {!!block.intro && <Text style={styles.intro}>{block.intro}</Text>}

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
              {pieces.map((p, i) => (
                <Text key={i} style={{ color: ROLE_TEXT[p.role] }}>{i === 0 ? cap(p.text) : p.text}</Text>
              ))}
            </Text>
            <Pressable
              onPress={() => speakSwahili(word)}
              style={styles.speak}
              accessibilityRole="button"
              accessibilityLabel={`Hear ${word} spoken`}
            >
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
          </View>
          <Text style={styles.en}>
            “{english}”{englishAlt ? <Text style={styles.enAlt}> / {englishAlt}</Text> : null}
          </Text>
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
  word: { fontSize: 27, fontWeight: '900' },
  en: { color: colors.ink, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  enAlt: { color: colors.muted, fontWeight: '400', fontSize: 13.5 },
});
