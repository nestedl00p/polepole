import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../api/client';
import { Button, Card, Spinner, ProgressBar } from '../components/ui';
import SpeakButton from '../components/SpeakButton';
import { colors, radius, shadowLg } from '../theme';

export default function FlashcardsScreen() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [i, setI] = useState(0);
  const [mode, setMode] = useState('cards'); // 'cards' | 'practice'

  // practice state
  const [pq, setPq] = useState([]);
  const [pi, setPi] = useState(0);
  const [pSel, setPSel] = useState(null);
  const [pScore, setPScore] = useState(0);
  const [pDone, setPDone] = useState(false);

  useEffect(() => {
    api.flashcards().then((d) => setCards(d.cards || [])).finally(() => setLoading(false));
  }, []);

  const startPractice = async () => {
    const d = await api.practice(10);
    setPq(d.questions || []);
    setPi(0);
    setPSel(null);
    setPScore(0);
    setPDone(false);
    setMode('practice');
  };

  if (loading) return <Spinner />;

  if (cards.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Card style={{ alignItems: 'center' }}>
          <Text style={styles.h1}>Flashcards</Text>
          <Text style={[styles.muted, { marginTop: 12, textAlign: 'center' }]}>
            Study a lesson first to start building your flashcard deck. Every word you learn appears
            here automatically.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  // ---- Practice mode ----
  if (mode === 'practice') {
    if (pDone) {
      return (
        <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.resultCard}>
            <Text style={styles.resultScore}>{pScore}/{pq.length}</Text>
            <Text style={styles.resultBanner}>Practice complete! 🎉</Text>
            <View style={styles.resultButtons}>
              <Button title="Practice again" onPress={startPractice} />
              <Button title="Back to cards" variant="ghost" onPress={() => setMode('cards')} />
            </View>
          </View>
        </ScrollView>
      );
    }

    const cur = pq[pi];
    const pick = (opt) => {
      if (pSel !== null) return;
      setPSel(opt);
      if (opt === cur.answer) setPScore((s) => s + 1);
    };
    const nextP = () => {
      if (pi + 1 >= pq.length) setPDone(true);
      else {
        setPi((x) => x + 1);
        setPSel(null);
      }
    };

    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.progressLabel}>Practice · {pi + 1} of {pq.length}</Text>
        <ProgressBar pct={((pi + 1) / pq.length) * 100} />
        <View style={[styles.questionCard, { marginTop: 18 }]}>
          <Text style={styles.prompt}>{cur.prompt}</Text>
          {cur.options.map((opt, idx) => {
            let extra = null;
            if (pSel !== null) {
              if (opt === cur.answer) extra = styles.optionCorrect;
              else if (opt === pSel) extra = styles.optionWrong;
            }
            return (
              <Pressable key={idx} onPress={() => pick(opt)} style={[styles.option, extra]}>
                <Text style={styles.optionText}>{opt}</Text>
              </Pressable>
            );
          })}
          {pSel !== null && (
            <Button
              title={pi + 1 >= pq.length ? 'See results' : 'Next →'}
              onPress={nextP}
              block
              style={{ marginTop: 8 }}
            />
          )}
        </View>
      </ScrollView>
    );
  }

  // ---- Card mode ----
  const card = cards[i];
  const go = (delta) => setI((x) => (x + delta + cards.length) % cards.length);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Text style={styles.h1}>Flashcards</Text>
        <Text style={styles.muted}>{cards.length} words from your lessons · Card {i + 1}</Text>
      </View>

      <FlipCard key={i} card={card} />

      <View style={styles.navRow}>
        <Button title="← Previous" variant="ghost" onPress={() => go(-1)} />
        <Button title="Next →" variant="ghost" onPress={() => go(1)} />
      </View>

      <Card style={{ marginTop: 18, alignItems: 'center' }}>
        <Text style={{ textAlign: 'center', marginBottom: 16, lineHeight: 22, color: colors.ink }}>
          <Text style={{ fontWeight: '700' }}>Test your memory </Text>
          with a quick 10-question mixed practice quiz.
        </Text>
        <Button title="Start practice quiz →" variant="gold" onPress={startPractice} />
      </Card>
    </ScrollView>
  );
}

function FlipCard({ card }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [flipped, setFlipped] = useState(false);

  const flip = () => {
    Animated.spring(anim, {
      toValue: flipped ? 0 : 1,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    setFlipped((f) => !f);
  };

  const frontRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  return (
    <Pressable onPress={flip} style={styles.flashcard}>
      <Animated.View
        style={[styles.face, { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] }]}
      >
        <LinearGradient
          colors={[colors.teal, colors.tealDark]}
          style={styles.faceInner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.faceSpeak}><SpeakButton text={card.swahili} variant="onDark" /></View>
          <Text style={styles.faceBig}>{card.swahili}</Text>
          <Text style={styles.faceTiny}>Tap to reveal · {card.lessonTitle}</Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View
        style={[
          styles.face,
          styles.faceBack,
          { transform: [{ perspective: 1200 }, { rotateY: backRotate }] },
        ]}
      >
        <LinearGradient
          colors={[colors.gold, colors.goldLight]}
          style={styles.faceInner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.faceSpeak}><SpeakButton text={card.swahili} variant="onDark" /></View>
          <Text style={styles.faceBig}>{card.english}</Text>
          <Text style={styles.faceTiny}>{card.swahili}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, backgroundColor: colors.cream, flexGrow: 1 },
  h1: { fontSize: 24, color: colors.navy, fontWeight: '800' },
  muted: { color: colors.muted },

  flashcard: { width: '100%', maxWidth: 420, height: 240, alignSelf: 'center', marginBottom: 20 },
  face: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: radius,
    backfaceVisibility: 'hidden',
    ...shadowLg,
  },
  faceBack: {},
  faceInner: {
    flex: 1,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  faceBig: { fontSize: 30, fontWeight: '800', color: '#fff', textAlign: 'center' },
  faceTiny: { color: 'rgba(255,255,255,0.85)', marginTop: 8, fontSize: 13.5, textAlign: 'center' },
  faceSpeak: { position: 'absolute', top: 12, right: 12, zIndex: 2 },

  navRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },

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
  optionCorrect: { borderColor: colors.success, backgroundColor: colors.successTint },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  optionText: { fontSize: 16, color: colors.ink },

  resultCard: {
    backgroundColor: '#fff',
    borderRadius: radius,
    padding: 30,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    ...shadowLg,
  },
  resultScore: { fontSize: 48, fontWeight: '900', color: colors.tealDark },
  resultBanner: { fontSize: 21, fontWeight: '800', color: colors.success, marginTop: 4 },
  resultButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 18 },
});
