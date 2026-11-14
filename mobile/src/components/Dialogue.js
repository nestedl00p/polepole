import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';
import SpeakButton from './SpeakButton';
import { Button } from './ui';
import { speakSwahili, speakAndWait, stopSpeaking } from '../lib/speak';
import { useAuth } from '../context/AuthContext';
import { lessonStrings } from '../lib/lessonStrings';

// Dialogue block. `swahili` holds the line in the language being learned and
// `english` its translation, in both course directions.
//  - 🔊 per line, and Listen plays the whole conversation line by line
//  - translations can be hidden (tap to peek)
//  - pick a speaker to role-play: that speaker's lines are covered until you
//    have said them and tap to check
export default function Dialogue({ block }) {
  const { user } = useAuth();
  const t = lessonStrings(user?.course);
  const lines = block.dialogue || [];
  const speakers = [...new Set(lines.map((d) => d.speaker))];

  const [playing, setPlaying] = useState(-1);
  const [hideTr, setHideTr] = useState(false);
  const [role, setRole] = useState(null);
  const [shown, setShown] = useState(() => new Set()); // lines peeked / checked
  const run = useRef(0);

  useEffect(() => () => { run.current++; stopSpeaking(); }, []);

  const stop = () => { run.current++; stopSpeaking(); setPlaying(-1); };

  const listen = async () => {
    if (playing !== -1) return stop();
    const id = ++run.current;
    for (let i = 0; i < lines.length; i++) {
      if (run.current !== id) return;
      setPlaying(i);
      await speakAndWait(lines[i].swahili);
      if (run.current !== id) return;
      await new Promise((r) => setTimeout(r, 350));
    }
    if (run.current === id) setPlaying(-1);
  };

  const pickRole = (s) => { setRole((r) => (r === s ? null : s)); setShown(new Set()); };
  const show = (i) => setShown((s) => new Set(s).add(i));

  return (
    <View style={styles.block}>
      <View style={styles.bar}>
        <Button title={playing === -1 ? t.listen : t.stop} size="sm" onPress={listen} />
        <Button
          title={hideTr ? t.showTranslations : t.hideTranslations}
          variant="ghost"
          size="sm"
          onPress={() => { setHideTr((h) => !h); setShown(new Set()); }}
        />
      </View>
      {speakers.length > 1 && (
        <View style={styles.bar}>
          <Text style={styles.rolesLabel}>{t.playRole}</Text>
          {speakers.map((s) => (
            <Pressable
              key={s}
              onPress={() => pickRole(s)}
              accessibilityRole="button"
              accessibilityState={{ selected: role === s }}
              style={[styles.chip, role === s && styles.chipActive]}
            >
              <Text style={[styles.chipText, role === s && styles.chipTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {lines.map((d, i) => {
        const mine = role === d.speaker;
        const covered = mine && !shown.has(i);
        const trHidden = hideTr && !mine && !shown.has(i);
        return (
          <View key={i} style={[styles.line, playing === i && styles.linePlaying, mine && styles.lineMine]}>
            <View style={styles.top}>
              <View style={styles.textWrap}>
                {covered ? (
                  <>
                    <Text style={styles.speaker}>{d.speaker}:</Text>
                    <Pressable
                      onPress={() => { show(i); speakSwahili(d.swahili); }}
                      style={styles.cover}
                      accessibilityRole="button"
                    >
                      <Text style={styles.coverText}>{t.yourLine}</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.lineText}>
                    <Text style={styles.speaker}>{d.speaker}: </Text>
                    <Text style={styles.swahili}>{d.swahili}</Text>
                  </Text>
                )}
              </View>
              {!covered && <SpeakButton text={d.swahili} size="sm" />}
            </View>
            {trHidden ? (
              <Pressable onPress={() => show(i)} style={styles.cover} accessibilityRole="button">
                <Text style={styles.coverText}>{t.tapToReveal}</Text>
              </Pressable>
            ) : (
              <Text style={styles.english}>{d.english}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 20 },
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 },
  rolesLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  chip: { borderWidth: 1.5, borderColor: colors.line, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13 },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff' },

  line: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, marginBottom: 8 },
  linePlaying: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  lineMine: { borderLeftWidth: 4, borderLeftColor: colors.gold },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  textWrap: { flex: 1 },
  lineText: { fontSize: 15 },
  speaker: { fontWeight: '800', color: colors.tealDark, fontSize: 15 },
  swahili: { fontWeight: '600', color: colors.ink },
  english: { color: colors.muted, fontSize: 13.5, fontStyle: 'italic', marginTop: 2 },
  cover: { alignSelf: 'flex-start', marginTop: 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.gold, backgroundColor: colors.goldTint, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 11 },
  coverText: { color: '#8a5c05', fontSize: 12.5, fontWeight: '700' },
});
