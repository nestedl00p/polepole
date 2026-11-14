import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Spinner, ProgressBar } from '../components/ui';
import { colors, radius, shadow, shadowLg } from '../theme';

// Leads with the Dose, not the course — the same restructure as the web
// dashboard. The 31-card grid is folded away so there is one primary action and
// one named next lesson above it.
//
// See docs/DAILY-PRACTICE-LOOP.md.

const WEEK_TITLES = {
  1: 'Foundations',
  2: 'Noun Classes, Numbers & Time',
  3: 'Tenses & Daily Life',
  4: 'Complex Sentences & Culture',
};

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [dose, setDose] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Reload every time the screen regains focus (e.g. after passing a quiz or
  // finishing a dose).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        api.listLessons(),
        // A dose that cannot be built yet is not an error — the hero points at
        // a lesson instead.
        api.dose().catch(() => null),
      ])
        .then(([lessons, d]) => {
          if (!active) return;
          setData(lessons);
          setDose(d);
        })
        .finally(() => active && setLoading(false));
      return () => { active = false; };
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

  // Today's lesson: the first one open and not yet passed.
  const nextLesson =
    data.lessons.find((l) => l.unlocked && !l.quizCompleted) ??
    data.lessons.filter((l) => l.unlocked).slice(-1)[0];

  const doseReady = !!dose && dose.items?.length > 0;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.head}>
        <Text style={styles.h1}>Karibu, {user.displayName}! 👋</Text>
        <Text style={styles.muted}>
          Day {data.currentDay} of your {data.planLengthDays}-day plan.
        </Text>
      </View>

      {/* The one primary action on the screen. */}
      <View style={[styles.hero, !doseReady && styles.heroDone]}>
        <Text style={styles.heroKicker}>DOSE YA LEO</Text>
        <Text style={styles.heroTitle}>
          {doseReady ? `${dose.items.length} items` : 'Nothing due yet'}
        </Text>
        <Text style={styles.heroSub}>
          {doseReady
            ? 'About ninety seconds. One of them you say out loud.'
            : (dose?.message ?? 'Study a lesson and your review queue starts filling.')}
        </Text>
        {doseReady ? (
          <Button title="Anza →" variant="gold" style={styles.heroBtn} onPress={() => navigation.navigate('Dose')} />
        ) : nextLesson ? (
          <Button
            title="Open a lesson →"
            variant="gold"
            style={styles.heroBtn}
            onPress={() => navigation.navigate('Lesson', { id: nextLesson.id })}
          />
        ) : null}
      </View>

      {/* The lesson is still here — just no longer the first decision. */}
      {nextLesson && (
        <Card style={styles.nextLesson}>
          <View style={styles.spread}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.nextKicker}>
                {nextLesson.quizCompleted ? 'LAST LESSON' : 'SOMO LA LEO'} · DAY {nextLesson.id}
              </Text>
              <Text style={styles.nextTitle}>{nextLesson.title}</Text>
              <Text style={styles.nextSub}>{nextLesson.subtitle}</Text>
            </View>
            <Button
              title={nextLesson.lessonViewed ? 'Continue →' : 'Start →'}
              variant="ghost"
              size="sm"
              onPress={() => navigation.navigate('Lesson', { id: nextLesson.id })}
            />
          </View>
        </Card>
      )}

      <View style={styles.statsGrid}>
        <Stat num={`${completed}/${data.totalLessons}`} label="Lessons done" />
        <Stat num={`${user.streakCount} 🔥`} label="Day streak" />
        <Stat num={`${user.totalXp}`} label="Total XP" />
        <Stat num={`${pct}%`} label="Course complete" />
      </View>

      <Card style={{ marginBottom: 20 }}>
        <View style={styles.spread}>
          <Text style={styles.bold}>Overall progress</Text>
          <Text style={styles.muted}>{completed} of {data.totalLessons} lessons</Text>
        </View>
        <ProgressBar pct={pct} />
      </Card>

      <Button
        title={showAll ? 'Hide all lessons' : `All ${data.totalLessons} lessons`}
        variant="ghost"
        size="sm"
        style={{ marginBottom: 20 }}
        onPress={() => setShowAll((s) => !s)}
      />

      {showAll && [1, 2, 3, 4].map((w) => {
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
  head: { marginBottom: 18 },
  h1: { fontSize: 24, color: colors.navy, fontWeight: '800', marginBottom: 4 },
  muted: { color: colors.muted },
  bold: { fontWeight: '700', color: colors.ink },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  hero: {
    backgroundColor: colors.navy,
    borderRadius: radius,
    padding: 22,
    marginBottom: 16,
    ...shadowLg,
  },
  heroDone: { backgroundColor: colors.tealDark },
  heroKicker: { fontSize: 11, fontWeight: '800', color: colors.goldLight, letterSpacing: 1.4 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 2, marginBottom: 4 },
  heroSub: { color: '#cfe0e8', fontSize: 14.5, lineHeight: 20 },
  heroBtn: { marginTop: 16 },

  nextLesson: { marginBottom: 20 },
  nextKicker: { fontSize: 11, fontWeight: '800', color: colors.teal, letterSpacing: 1 },
  nextTitle: { color: colors.navy, fontSize: 17, fontWeight: '700', marginTop: 3 },
  nextSub: { color: colors.muted, fontSize: 14, marginTop: 2 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
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
