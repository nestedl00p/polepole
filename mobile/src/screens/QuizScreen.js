import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Spinner, ProgressBar, Input } from '../components/ui';
import { colors, radius, shadowLg } from '../theme';

export default function QuizScreen({ route, navigation }) {
  const { id } = route.params;
  const { refreshUser } = useAuth();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // questionId -> answer
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getLesson(id).then(setLesson).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (!lesson) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>Quiz not found.</Text>
      </View>
    );
  }

  const questions = lesson.quiz;
  const q = questions[idx];
  const total = questions.length;
  const current = answers[q?.id] ?? '';

  const setAnswer = (val) => setAnswers((a) => ({ ...a, [q.id]: val }));
  const next = () => {
    setShowHint(false);
    setIdx((i) => Math.min(i + 1, total - 1));
  };
  const prev = () => {
    setShowHint(false);
    setIdx((i) => Math.max(i - 1, 0));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = questions.map((qq) => ({ questionId: qq.id, answer: answers[qq.id] ?? '' }));
      const res = await api.submitQuiz(lesson.id, payload);
      setResult(res);
      await refreshUser();
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Result screen -----
  if (result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <View style={[styles.questionCard, styles.resultCard]}>
          <Text style={styles.resultScore}>{result.score}/{result.total}</Text>
          <Text style={[styles.resultBanner, { color: result.passed ? colors.success : colors.danger }]}>
            {result.passed ? '🎉 Umefaulu! You passed!' : 'Karibu tena — try again to pass'}
          </Text>
          <Text style={[styles.muted, { marginTop: 8, textAlign: 'center' }]}>
            {pct}% correct {result.passed ? '(70% needed to advance)' : '— you need 70% to unlock the next lesson'}
          </Text>
          {result.xpEarned > 0 && (
            <View style={styles.xpPop}>
              <Text style={styles.xpPopText}>+{result.xpEarned} XP ⭐</Text>
            </View>
          )}

          <View style={styles.reviewWrap}>
            <Text style={styles.reviewHeading}>Review</Text>
            {result.feedback.map((f, i) => {
              const question = questions.find((x) => x.id === f.questionId);
              return (
                <View key={i} style={styles.reviewLine}>
                  <Text style={styles.reviewPrompt}>{i + 1}. {question?.prompt}</Text>
                  <Text style={[styles.reviewResult, { color: f.correct ? colors.success : colors.danger }]}>
                    {f.correct
                      ? '✓ Correct'
                      : `✗ Your answer: ${f.yourAnswer || '(blank)'} — Correct: ${f.correctAnswer}`}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.resultButtons}>
            {result.passed ? (
              <>
                <Button title="Back to dashboard →" onPress={() => navigation.navigate('Tabs')} />
                {lesson.id < 31 && (
                  <Button
                    title="Next lesson →"
                    variant="gold"
                    onPress={() => navigation.replace('Lesson', { id: lesson.id + 1 })}
                  />
                )}
              </>
            ) : (
              <>
                <Button
                  title="Try again"
                  variant="ghost"
                  onPress={() => {
                    setResult(null);
                    setIdx(0);
                  }}
                />
                <Button title="Review lesson" onPress={() => navigation.navigate('Lesson', { id: lesson.id })} />
              </>
            )}
          </View>
        </View>
      </ScrollView>
    );
  }

  // ----- Question screen -----
  const allAnswered = questions.every((qq) => (answers[qq.id] ?? '').trim() !== '');

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.progressLabel}>Question {idx + 1} of {total} · {lesson.title}</Text>
      <ProgressBar pct={((idx + 1) / total) * 100} />

      <View style={[styles.questionCard, { marginTop: 18 }]}>
        <Text style={styles.prompt}>{q.prompt}</Text>

        {q.type === 'multiple_choice' ? (
          <View>
            {q.options.map((opt, i) => {
              const selected = current === opt;
              return (
                <Pressable
                  key={i}
                  onPress={() => setAnswer(opt)}
                  style={[styles.option, selected && styles.optionSelected]}
                >
                  <Text style={styles.optionText}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View>
            <Input
              value={current}
              onChangeText={setAnswer}
              placeholder="Type your answer in Swahili…"
              autoCapitalize="none"
              returnKeyType={idx < total - 1 ? 'next' : 'done'}
              onSubmitEditing={() => idx < total - 1 && next()}
              style={styles.textAnswer}
            />
            {q.hint && (
              <Pressable onPress={() => setShowHint((s) => !s)}>
                <Text style={styles.hint}>{showHint ? `💡 ${q.hint}` : '💡 Show hint'}</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.navRow}>
          <Button title="← Prev" variant="ghost" size="sm" onPress={prev} disabled={idx === 0} />
          {idx < total - 1 ? (
            <Button title="Next →" size="sm" onPress={next} />
          ) : (
            <Button
              title={submitting ? 'Grading…' : 'Submit quiz'}
              variant="gold"
              onPress={submit}
              disabled={!allAnswered || submitting}
            />
          )}
        </View>

        {!allAnswered && idx === total - 1 && (
          <Text style={[styles.muted, { marginTop: 12, fontSize: 13 }]}>
            Answer every question before submitting.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, backgroundColor: colors.cream },
  muted: { color: colors.muted },

  progressLabel: { color: colors.muted, fontWeight: '600', marginBottom: 8 },

  questionCard: {
    backgroundColor: '#fff',
    borderRadius: radius,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadowLg,
  },
  prompt: { fontSize: 19, color: colors.navy, fontWeight: '700', marginBottom: 20 },

  option: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  optionSelected: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  optionText: { fontSize: 16, color: colors.ink },

  textAnswer: { fontSize: 16.5, paddingVertical: 14, borderWidth: 2 },
  hint: { color: colors.gold, fontSize: 14, marginTop: 10, fontWeight: '600' },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },

  // result
  resultCard: { alignItems: 'center', padding: 30 },
  resultScore: { fontSize: 48, fontWeight: '900', color: colors.tealDark },
  resultBanner: { fontSize: 21, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  xpPop: {
    backgroundColor: colors.gold,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
    marginTop: 12,
  },
  xpPopText: { color: '#fff', fontWeight: '800' },

  reviewWrap: { alignSelf: 'stretch', marginTop: 18 },
  reviewHeading: { fontSize: 17, fontWeight: '800', color: colors.tealDark, marginBottom: 10 },
  reviewLine: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  reviewPrompt: { fontWeight: '600', color: colors.ink },
  reviewResult: { fontWeight: '700', marginTop: 6 },

  resultButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 18 },
});
