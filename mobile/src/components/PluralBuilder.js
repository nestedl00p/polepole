import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, shadow } from '../theme';
import { speakSwahili } from '../lib/speak';

// English plural builder — singular → plural. Swahili marks plural with a class
// prefix (mtu → watu); English adds a suffix, with irregulars to memorise.

const NOUNS = [
  { sing: 'book', plural: 'books', sw: 'kitabu / vitabu', rule: '+s', why: 'Nyingi huongeza "-s" tu.' },
  { sing: 'car', plural: 'cars', sw: 'gari / magari', rule: '+s', why: 'Nyingi huongeza "-s" tu.' },
  { sing: 'box', plural: 'boxes', sw: 'sanduku / masanduku', rule: '+es', why: 'Inaishia -x, -s, -ch, -sh → ongeza "-es".' },
  { sing: 'watch', plural: 'watches', sw: 'saa / saa', rule: '+es', why: 'Inaishia -ch → ongeza "-es".' },
  { sing: 'baby', plural: 'babies', sw: 'mtoto / watoto', rule: 'y → ies', why: 'Konsonanti + y → badilisha y kuwa "-ies".' },
  { sing: 'city', plural: 'cities', sw: 'jiji / majiji', rule: 'y → ies', why: 'Konsonanti + y → badilisha y kuwa "-ies".' },
  { sing: 'child', plural: 'children', sw: 'mtoto / watoto', rule: 'kipekee', why: 'Haifuati kanuni — lazima ukariri.' },
  { sing: 'man', plural: 'men', sw: 'mwanamume / wanaume', rule: 'kipekee', why: 'Haifuati kanuni — lazima ukariri.' },
  { sing: 'woman', plural: 'women', sw: 'mwanamke / wanawake', rule: 'kipekee', why: 'Haifuati kanuni — lazima ukariri.' },
  { sing: 'foot', plural: 'feet', sw: 'mguu / miguu', rule: 'kipekee', why: 'Haifuati kanuni — lazima ukariri.' },
  { sing: 'fish', plural: 'fish', sw: 'samaki / samaki', rule: 'haibadiliki', why: 'Umoja na wingi ni sawa — kama "samaki".' },
];

function split(sing, plural) {
  let i = 0;
  while (i < sing.length && i < plural.length && sing[i] === plural[i]) i++;
  return { head: plural.slice(0, i), tail: plural.slice(i) };
}

export default function PluralBuilder({ block = {} }) {
  const nouns = block.nouns || NOUNS;
  const [i, setI] = useState(0);
  const n = nouns[i];
  const { head, tail } = split(n.sing, n.plural);

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Text style={styles.title}>{block.calloutTitle || 'Umoja → Wingi'}</Text>
        <Text style={styles.intro}>
          {block.intro ||
            'Kiswahili hubadilisha mwanzo wa neno (mtu → watu). Kiingereza hubadilisha mwisho — mara nyingi kwa "-s".'}
        </Text>

        <View style={styles.step}>
          <View style={styles.stepLabel}>
            <View style={[styles.dot, { backgroundColor: colors.navy }]} />
            <Text style={styles.stepLabelText}>Gusa nomino</Text>
          </View>
          <View style={styles.pills}>
            {nouns.map((item, idx) => {
              const active = idx === i;
              return (
                <Pressable key={item.sing} onPress={() => setI(idx)}
                  style={[styles.pill, active && { borderColor: colors.navy, backgroundColor: colors.navy }]}>
                  <Text style={[styles.pillSw, active && styles.pillActiveText]}>{item.sing}</Text>
                  <Text style={[styles.pillEn, active && styles.pillActiveText]}>{item.rule}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.result}>
          <Text style={styles.badge}>{n.rule}</Text>
          <View style={styles.wordRow}>
            <Text style={styles.word}>
              <Text style={{ color: colors.navy }}>{n.sing}</Text>
              <Text style={{ color: colors.muted }}>{'  →  '}</Text>
              <Text style={{ color: colors.navy }}>{head}</Text>
              <Text style={{ color: colors.gold }}>{tail}</Text>
            </Text>
            <Pressable onPress={() => speakSwahili(`${n.sing}, ${n.plural}`)} style={styles.speak}
              accessibilityRole="button" accessibilityLabel={`Sikiliza ${n.sing}, ${n.plural}`}>
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
          </View>
          <Text style={styles.en}>“{n.sw}”</Text>
          <Text style={styles.tip}>💡 {n.why}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 20 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderLeftWidth: 5, borderLeftColor: colors.teal, borderRadius: 12, padding: 18, ...shadow },
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
  result: { backgroundColor: colors.light, borderRadius: 10, padding: 16, alignItems: 'center' },
  badge: { backgroundColor: colors.navy, color: '#fff', fontWeight: '800', fontSize: 12, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, overflow: 'hidden', marginBottom: 12 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  word: { fontSize: 22, fontWeight: '900' },
  speak: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.teal, backgroundColor: '#fff' },
  speakIcon: { fontSize: 18 },
  en: { color: colors.ink, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  tip: { color: colors.muted, fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 19 },
});
