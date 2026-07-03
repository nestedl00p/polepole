import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, shadow } from '../theme';
import { speakSwahili } from '../lib/speak';

// Interactive question-word explorer: tap a question word to see/hear it in a
// real sentence (highlighted) and learn where it sits.

const QUESTIONS = [
  { word: 'nani', en: 'who', ex: '[Nani] anakuja?', exEn: 'Who is coming?', tip: 'subject — starts the sentence' },
  { word: 'nini', en: 'what', ex: 'Unataka [nini]?', exEn: 'What do you want?', tip: 'goes at the end' },
  { word: 'wapi', en: 'where', ex: 'Unakaa [wapi]?', exEn: 'Where do you live?', tip: 'goes at the end' },
  { word: 'lini', en: 'when', ex: 'Utasafiri [lini]?', exEn: 'When will you travel?', tip: 'goes at the end' },
  { word: 'kwa nini', en: 'why', ex: '[Kwa nini] unalia?', exEn: 'Why are you crying?', tip: 'starts the sentence' },
  { word: 'ngapi', en: 'how many', ex: 'Una vitabu [vingapi]?', exEn: 'How many books do you have?', tip: 'takes a class prefix (vi-ngapi)' },
  { word: 'gani', en: 'which', ex: 'Unapenda chai [gani]?', exEn: 'Which tea do you like?', tip: 'follows the noun' },
];

function segments(ex) {
  return ex.split(/(\[[^\]]*\])/).filter(Boolean).map((part) => {
    if (part.startsWith('[') && part.endsWith(']')) return { text: part.slice(1, -1), hl: true };
    return { text: part, hl: false };
  });
}

export default function QuestionBuilder({ block = {} }) {
  const questions = block.questions || QUESTIONS;
  const [qi, setQi] = useState(2);
  const q = questions[qi];
  const plain = q.ex.replace(/[[\]]/g, '');

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Text style={styles.title}>{block.calloutTitle || 'Ask a question'}</Text>
        {!!block.intro && <Text style={styles.intro}>{block.intro}</Text>}

        <View style={styles.step}>
          <View style={styles.stepLabel}>
            <View style={[styles.dot, { backgroundColor: colors.gold }]} />
            <Text style={styles.stepLabelText}>Tap a question word</Text>
          </View>
          <View style={styles.pills}>
            {questions.map((item, i) => {
              const active = i === qi;
              return (
                <Pressable
                  key={item.word}
                  onPress={() => setQi(i)}
                  style={[styles.pill, active && { borderColor: colors.gold, backgroundColor: colors.gold }]}
                >
                  <Text style={[styles.pillSw, active && styles.pillActiveText]}>{item.word}</Text>
                  <Text style={[styles.pillEn, active && styles.pillActiveText]}>{item.en}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.result}>
          <View style={styles.wordRow}>
            <Text style={styles.sentence}>
              {segments(q.ex).map((s, i) => (
                <Text key={i} style={{ color: s.hl ? colors.gold : colors.navy }}>{s.text}</Text>
              ))}
            </Text>
            <Pressable onPress={() => speakSwahili(plain)} style={styles.speak} accessibilityRole="button" accessibilityLabel={`Hear ${plain} spoken`}>
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
          </View>
          <Text style={styles.en}>“{q.exEn}”</Text>
          <Text style={styles.tip}>💡 <Text style={{ color: colors.gold, fontWeight: '800' }}>{q.word}</Text> — {q.tip}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 20 },
  card: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line,
    borderLeftWidth: 5, borderLeftColor: colors.gold, borderRadius: 12, padding: 18, ...shadow,
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
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sentence: { fontSize: 20, fontWeight: '800', flexShrink: 1 },
  speak: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.teal, backgroundColor: '#fff',
  },
  speakIcon: { fontSize: 18 },
  en: { color: colors.ink, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  tip: { color: colors.muted, fontSize: 13, marginTop: 10, textAlign: 'center' },
});
