import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { colors, shadow } from '../theme';
import { Button } from './ui';
import { useAuth } from '../context/AuthContext';
import { lessonStrings, shuffled } from '../lib/lessonStrings';

// In-lesson practice questions with instant feedback (ungraded — the real quiz
// is still at the end). One question at a time: a wrong tap shakes and can be
// retried; the right one shows a one-line explanation.
export default function QuickCheck({ block = {} }) {
  const { user } = useAuth();
  const t = lessonStrings(user?.course);
  const questions = block.questions || [];
  const [round, setRound] = useState(0);
  const [qi, setQi] = useState(0);
  const [wrong, setWrong] = useState([]);   // options tried and rejected
  const [solved, setSolved] = useState(false);
  const [firstTry, setFirstTry] = useState(0);
  const [done, setDone] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const q = questions[qi];
  // Authors list the answer wherever is convenient; shuffle so it moves around.
  const options = useMemo(() => (q ? shuffled(q.options) : []), [q, round]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!q) return null;

  const runShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const pick = (opt) => {
    if (solved || wrong.includes(opt)) return;
    if (opt === q.answer) {
      setSolved(true);
      if (wrong.length === 0) setFirstTry((n) => n + 1);
    } else {
      setWrong((w) => [...w, opt]);
      runShake();
    }
  };

  const next = () => {
    setWrong([]);
    setSolved(false);
    if (qi + 1 >= questions.length) setDone(true);
    else setQi(qi + 1);
  };

  const restart = () => { setDone(false); setQi(0); setFirstTry(0); setWrong([]); setSolved(false); setRound((r) => r + 1); };

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Text style={styles.title}>{block.calloutTitle || t.quickCheck}</Text>
        {!!block.intro && <Text style={styles.intro}>{block.intro}</Text>}

        {done ? (
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ fontSize: 40 }}>{firstTry === questions.length ? '🎉' : '👍'}</Text>
            <Text style={styles.doneTitle}>{t.checkDone(firstTry, questions.length)}</Text>
            <Button title={t.again} variant="ghost" size="sm" onPress={restart} />
          </View>
        ) : (
          <>
            <View style={styles.progress}>
              {questions.map((_, i) => (
                <View key={i} style={[styles.dot, i < qi && styles.dotDone, i === qi && styles.dotActive]} />
              ))}
              <Text style={styles.count}>{qi + 1} / {questions.length}</Text>
            </View>

            <Text style={styles.prompt}>{q.prompt}</Text>
            <Animated.View style={{ transform: [{ translateX }] }}>
              {options.map((opt) => {
                const isWrong = wrong.includes(opt);
                const isRight = solved && opt === q.answer;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => pick(opt)}
                    disabled={isWrong || solved}
                    accessibilityRole="button"
                    style={[
                      styles.option,
                      isRight && styles.optionRight,
                      isWrong && styles.optionWrong,
                      solved && !isRight && !isWrong && { opacity: 0.5 },
                    ]}
                  >
                    <Text style={[styles.optionText, isRight && styles.optionTextRight]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </Animated.View>

            {solved ? (
              <View style={styles.feedback}>
                <Text style={styles.explain}>
                  <Text style={styles.msgCorrect}>✓ {t.correct} </Text>
                  {q.explain || ''}
                </Text>
                <Button title={qi + 1 >= questions.length ? t.finish : t.next} size="sm" onPress={next} />
              </View>
            ) : wrong.length > 0 ? (
              <Text style={styles.msgWrong}>{t.tryAgain}</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 20 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderLeftWidth: 5, borderLeftColor: colors.gold, borderRadius: 12, padding: 18, ...shadow },
  title: { fontWeight: '800', color: colors.navy, fontSize: 17, marginBottom: 10 },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 12 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.line },
  dotDone: { backgroundColor: colors.success },
  dotActive: { backgroundColor: colors.gold, transform: [{ scale: 1.25 }] },
  count: { marginLeft: 'auto', color: colors.muted, fontSize: 12, fontWeight: '700' },
  prompt: { color: colors.navy, fontSize: 16.5, fontWeight: '700', lineHeight: 23, marginBottom: 12 },
  option: { borderWidth: 2, borderColor: colors.line, borderRadius: 12, backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 15, marginBottom: 8 },
  optionRight: { borderColor: colors.success, backgroundColor: colors.successTint },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerTint, opacity: 0.65 },
  optionText: { color: colors.ink, fontSize: 15.5 },
  optionTextRight: { color: '#1d7a43', fontWeight: '700' },
  feedback: { marginTop: 6, gap: 10, alignItems: 'flex-start' },
  explain: { color: colors.ink, fontSize: 14.5, lineHeight: 21 },
  msgCorrect: { color: colors.success, fontWeight: '800' },
  msgWrong: { color: colors.danger, fontWeight: '800', marginTop: 6 },
  doneTitle: { fontSize: 17, fontWeight: '800', color: colors.navy, marginVertical: 10, textAlign: 'center' },
});
