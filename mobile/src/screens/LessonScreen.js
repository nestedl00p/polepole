import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { api } from '../api/client';
import ContentBlock from '../components/ContentBlock';
import SpeakButton from '../components/SpeakButton';
import { Button, Card, Spinner, ErrorBox } from '../components/ui';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';

export default function LessonScreen({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  // Vocab pairs are stored as {swahili, english}; which side is being learned
  // (and spoken) depends on the account's course direction.
  const learnEnglish = user?.course?.targetLanguage === 'en';
  const learning = (v) => (learnEnglish ? v.english : v.swahili);
  const known = (v) => (learnEnglish ? v.swahili : v.english);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .getLesson(id)
      .then(setLesson)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (error) {
    return (
      <View style={styles.page}>
        <ErrorBox>{error}</ErrorBox>
        <Button title="← Back to dashboard" variant="ghost" onPress={() => navigation.navigate('Tabs')} />
      </View>
    );
  }
  if (!lesson) return null;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.head}>
        <Text style={styles.dayNum}>Day {lesson.id} · {lesson.theme}</Text>
        <Text style={styles.title}>{lesson.title}</Text>
        <Text style={styles.subtitle}>{lesson.subtitle}</Text>
      </View>

      {lesson.blocks.map((b, i) => (
        <ContentBlock key={i} block={b} />
      ))}

      {lesson.vocabulary?.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.heading}>Vocabulary</Text>
          <View style={styles.vocabGrid}>
            {lesson.vocabulary.map((v, i) => (
              <View key={i} style={styles.vocabChip}>
                <View style={styles.vocabSwRow}>
                  <Text style={styles.vocabSw}>{learning(v)}</Text>
                  <SpeakButton text={learning(v)} size="sm" />
                </View>
                <Text style={styles.vocabEn}>{known(v)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Card style={styles.cta}>
        <Text style={styles.ctaText}>
          <Text style={styles.bold}>Ready to test yourself? </Text>
          Pass the quiz (70%+) to earn XP and unlock the next lesson.
        </Text>
        <Button
          title={`Take the quiz · ${lesson.quiz.length} questions →`}
          variant="gold"
          onPress={() => navigation.navigate('Quiz', { id: lesson.id })}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, backgroundColor: colors.cream },
  head: { marginBottom: 22 },
  dayNum: {
    fontSize: 13,
    color: colors.teal,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { fontSize: 24, color: colors.navy, fontWeight: '800', marginVertical: 4 },
  subtitle: { color: colors.muted, fontSize: 16 },

  block: { marginBottom: 20 },
  heading: {
    fontSize: 20,
    color: colors.tealDark,
    fontWeight: '800',
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
    paddingBottom: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  vocabGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vocabChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 13,
    flexGrow: 1,
    flexBasis: '45%',
  },
  vocabSwRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  vocabSw: { fontWeight: '800', color: colors.navy, fontSize: 15, flexShrink: 1 },
  vocabEn: { color: colors.muted, fontSize: 13.5, marginTop: 2 },

  cta: { marginTop: 8, alignItems: 'center' },
  ctaText: { textAlign: 'center', color: colors.ink, marginBottom: 16, lineHeight: 22 },
  bold: { fontWeight: '700' },
});
