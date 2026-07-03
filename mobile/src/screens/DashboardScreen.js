import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, Spinner, ProgressBar } from '../components/ui';
import { colors, radius, shadow } from '../theme';

const WEEK_TITLES = {
  1: 'Foundations',
  2: 'Noun Classes, Numbers & Time',
  3: 'Tenses & Daily Life',
  4: 'Complex Sentences & Culture',
};

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Reload every time the screen regains focus (e.g. after passing a quiz).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        .listLessons()
        .then((d) => active && setData(d))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [])
  );

  if (loading) return <Spinner />;
  if (!data) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>Could not load lessons.</Text>
      </View>
    );
  }

  const completed = data.lessons.filter((l) => l.quizCompleted).length;
  const pct = Math.round((completed / data.totalLessons) * 100);
  const weeks = [1, 2, 3, 4];

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.head}>
        <Text style={styles.h1}>Karibu, {user.displayName}! 👋</Text>
        <Text style={styles.muted}>
          Your {data.planLengthDays}-day Swahili plan — you're scheduled for Day {data.currentDay}.
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <Stat num={`${completed}/${data.totalLessons}`} label="Lessons done" />
        <Stat num={`${user.streakCount} 🔥`} label="Day streak" />
        <Stat num={`${user.totalXp}`} label="Total XP" />
        <Stat num={`${pct}%`} label="Course complete" />
      </View>

      <Card style={{ marginBottom: 24 }}>
        <View style={styles.spread}>
          <Text style={styles.bold}>Overall progress</Text>
          <Text style={styles.muted}>{completed} of {data.totalLessons} lessons</Text>
        </View>
        <ProgressBar pct={pct} />
      </Card>

      {weeks.map((w) => {
        const lessons = data.lessons.filter((l) => l.week === w);
        if (!lessons.length) return null;
        return (
          <View key={w} style={styles.weekGroup}>
            <View style={styles.weekLabel}>
              <Text style={styles.weekTitle}>Week {w} — {WEEK_TITLES[w]}</Text>
              <View style={styles.weekLine} />
            </View>
            <View style={styles.lessonGrid}>
              {lessons.map((l) => (
                <LessonCard
                  key={l.id}
                  lesson={l}
                  onPress={() => l.unlocked && navigation.navigate('Lesson', { id: l.id })}
                />
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function Stat({ num, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function LessonCard({ lesson: l, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!l.unlocked}
      style={({ pressed }) => [
        styles.lessonCard,
        !l.unlocked && styles.lessonCardLocked,
        pressed && l.unlocked && { opacity: 0.9 },
      ]}
    >
      <Text style={styles.day}>Day {l.id} {l.unlocked ? '' : '🔒'}</Text>
      <Text style={styles.lessonTitle}>{l.title}</Text>
      <Text style={styles.lessonSub}>{l.subtitle}</Text>
      <View style={styles.foot}>
        <Text style={styles.themeTag}>{l.theme}</Text>
        {l.quizCompleted ? (
          <Badge tint={colors.successTint} color={colors.success}>✓ {l.bestQuizScore}/{l.quizTotal}</Badge>
        ) : l.lessonViewed ? (
          <Badge tint={colors.goldTint} color={colors.gold}>In progress</Badge>
        ) : l.unlocked ? (
          <Badge tint={colors.goldTint} color={colors.gold}>Start</Badge>
        ) : (
          <Badge tint={colors.lockTint} color={colors.muted}>Locked</Badge>
        )}
      </View>
    </Pressable>
  );
}

function Badge({ children, tint, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: tint }]}>
      <Text style={[styles.badgeText, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, backgroundColor: colors.cream },
  head: { marginBottom: 20 },
  h1: { fontSize: 24, color: colors.navy, fontWeight: '800', marginBottom: 4 },
  muted: { color: colors.muted },
  bold: { fontWeight: '700', color: colors.ink },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  stat: {
    backgroundColor: '#fff',
    borderRadius: radius,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    flexGrow: 1,
    flexBasis: '45%',
    ...shadow,
  },
  statNum: { fontSize: 24, fontWeight: '800', color: colors.tealDark },
  statLbl: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  weekGroup: { marginBottom: 24 },
  weekLabel: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  weekTitle: {
    fontSize: 13,
    color: colors.gold,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  weekLine: { flex: 1, height: 2, backgroundColor: colors.line },

  lessonGrid: { gap: 14 },
  lessonCard: {
    backgroundColor: '#fff',
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    minHeight: 130,
    ...shadow,
  },
  lessonCardLocked: { opacity: 0.6, backgroundColor: '#f6f4ee' },
  day: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.teal,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  lessonTitle: { fontSize: 17, color: colors.navy, fontWeight: '700', marginVertical: 4 },
  lessonSub: { color: colors.muted, fontSize: 14, flex: 1 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  themeTag: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  badge: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
