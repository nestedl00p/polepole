import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, shadow } from '../theme';
import { speakSwahili } from '../lib/speak';

// English verb builder, taught in Swahili. Driven by block.mode:
//   toBe | present | past | future | negative
// The mirror image of VerbBuilder: there the prefix carries the grammar, here
// it's the ending — and only "he/she/it" changes.

const VERBS = {
  work:  { sw: 'fanya kazi', past: 'worked',  irregular: false },
  read:  { sw: 'soma',       past: 'read',    irregular: true },
  eat:   { sw: 'kula',       past: 'ate',     irregular: true },
  go:    { sw: 'enda',       past: 'went',    irregular: true },
  want:  { sw: 'taka',       past: 'wanted',  irregular: false },
  play:  { sw: 'cheza',      past: 'played',  irregular: false },
  see:   { sw: 'ona',        past: 'saw',     irregular: true },
  speak: { sw: 'sema',       past: 'spoke',   irregular: true },
};

const SUBJECTS = [
  { en: 'I',        sw: 'mimi', be: 'am',  third: false },
  { en: 'You',      sw: 'wewe', be: 'are', third: false },
  { en: 'He / She', sw: 'yeye', be: 'is',  third: true },
  { en: 'We',       sw: 'sisi', be: 'are', third: false },
  { en: 'They',     sw: 'wao',  be: 'are', third: false },
];

function thirdPerson(verb) {
  if (/(o|ch|sh|s|x)$/.test(verb)) return verb + 'es';
  if (/[^aeiou]y$/.test(verb)) return verb.slice(0, -1) + 'ies';
  return verb + 's';
}

const ROLE = { sub: colors.teal, mark: colors.gold, stem: colors.navy, neg: colors.danger };

export default function EnglishVerbBuilder({ block = {} }) {
  const mode = block.mode || 'present';
  const verbKeys = block.verbKeys || ['work', 'read', 'eat', 'go', 'want', 'speak'];
  const verbs = verbKeys.map((k) => ({ key: k, ...VERBS[k] })).filter((v) => v.sw);

  const [si, setSi] = useState(0);
  const [vi, setVi] = useState(0);
  const subj = SUBJECTS[si];
  const verb = verbs[vi] || verbs[0];

  let pieces;
  let swahili;
  let tip = null;

  if (mode === 'toBe') {
    pieces = [
      { text: subj.en, role: 'sub', tag: 'nani' },
      { text: subj.be, role: 'mark', tag: 'kuwa' },
    ];
    swahili = `${subj.sw} ni…`;
    tip = 'Kiswahili hutumia "ni" kwa kila mtu. Kiingereza kina maumbo matatu: am / is / are.';
  } else if (mode === 'past') {
    pieces = [
      { text: subj.en, role: 'sub', tag: 'nani' },
      { text: verb.past, role: 'stem', tag: verb.irregular ? 'kipekee' : '+ed' },
    ];
    swahili = `${subj.sw} ali${verb.sw}`;
    tip = verb.irregular
      ? `"${verb.key}" ni kitenzi cha kipekee — lazima ukariri: ${verb.key} → ${verb.past}.`
      : 'Vitenzi vya kawaida huongeza "-ed" — kwa kila mtu, bila mabadiliko.';
  } else if (mode === 'future') {
    pieces = [
      { text: subj.en, role: 'sub', tag: 'nani' },
      { text: 'will', role: 'mark', tag: 'ta-' },
      { text: verb.key, role: 'stem', tag: 'kitenzi' },
    ];
    swahili = `${subj.sw} ata${verb.sw}`;
    tip = '"will" haibadiliki kamwe, na kitenzi hubaki kama kilivyo. Rahisi!';
  } else if (mode === 'negative') {
    const aux = subj.third ? "doesn't" : "don't";
    pieces = [
      { text: subj.en, role: 'sub', tag: 'nani' },
      { text: aux, role: 'neg', tag: 'si-' },
      { text: verb.key, role: 'stem', tag: 'kitenzi' },
    ];
    swahili = `${subj.sw} ha${verb.sw}`;
    tip = subj.third
      ? 'Kwa he/she/it tumia "doesn\'t" — na kitenzi HAKICHUKUI "-s".'
      : 'Tumia "don\'t" kwa I / you / we / they.';
  } else {
    const form = subj.third ? thirdPerson(verb.key) : verb.key;
    pieces = [
      { text: subj.en, role: 'sub', tag: 'nani' },
      { text: form, role: 'stem', tag: subj.third ? '+s' : 'kitenzi' },
    ];
    swahili = `${subj.sw} ana${verb.sw}`;
    tip = subj.third
      ? 'Kwa he / she / it PEKEE, kitenzi huongeza "-s". Hii ndiyo kanuni inayosahaulika zaidi.'
      : 'Kwa I / you / we / they kitenzi hakibadiliki hata kidogo.';
  }

  const phrase = pieces.map((p) => p.text).join(' ');

  const steps = [
    { accent: 'sub', label: '1 · Nani?', options: SUBJECTS.map((s) => ({ a: s.en, b: s.sw })), index: si, set: setSi },
  ];
  if (mode !== 'toBe') {
    steps.push({ accent: 'stem', label: '2 · Kitenzi gani?', options: verbs.map((v) => ({ a: v.key, b: v.sw })), index: vi, set: setVi });
  }

  return (
    <View style={styles.block}>
      <View style={[styles.card, { borderLeftColor: mode === 'negative' ? colors.danger : colors.teal }]}>
        <Text style={styles.title}>{block.calloutTitle || 'Jenga sentensi ya Kiingereza'}</Text>
        {!!block.intro && <Text style={styles.intro}>{block.intro}</Text>}

        {steps.map((step, idx) => (
          <View style={styles.step} key={idx}>
            <View style={styles.stepLabel}>
              <View style={[styles.dot, { backgroundColor: ROLE[step.accent] }]} />
              <Text style={styles.stepLabelText}>{step.label}</Text>
            </View>
            <View style={styles.pills}>
              {step.options.map((o, i) => {
                const active = i === step.index;
                return (
                  <Pressable key={o.a} onPress={() => step.set(i)}
                    style={[styles.pill, active && { borderColor: ROLE[step.accent], backgroundColor: ROLE[step.accent] }]}>
                    <Text style={[styles.pillSw, active && styles.pillActiveText]}>{o.a}</Text>
                    <Text style={[styles.pillEn, active && styles.pillActiveText]}>{o.b}</Text>
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
              <View style={[styles.piece, { backgroundColor: ROLE[p.role] }]}>
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
              {pieces.map((p, i) => (
                <Text key={i} style={{ color: ROLE[p.role] }}>{i > 0 ? ' ' : ''}{p.text}</Text>
              ))}
            </Text>
            <Pressable onPress={() => speakSwahili(phrase)} style={styles.speak}
              accessibilityRole="button" accessibilityLabel={`Sikiliza ${phrase}`}>
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
          </View>
          <Text style={styles.en}>“{swahili}”</Text>
          {!!tip && <Text style={styles.tip}>💡 {tip}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 20 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderLeftWidth: 5, borderRadius: 12, padding: 18, ...shadow },
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
  frag: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  piece: { alignItems: 'center', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 13, minWidth: 58 },
  pieceTag: { fontSize: 9, color: '#fff', fontWeight: '700', letterSpacing: 0.4 },
  pieceVal: { fontSize: 18, color: '#fff', fontWeight: '800' },
  op: { fontSize: 19, fontWeight: '800', color: colors.muted },
  result: { backgroundColor: colors.light, borderRadius: 10, padding: 16, alignItems: 'center' },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  word: { fontSize: 22, fontWeight: '900' },
  speak: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.teal, backgroundColor: '#fff' },
  speakIcon: { fontSize: 18 },
  en: { color: colors.ink, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  tip: { color: colors.muted, fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 19 },
});
