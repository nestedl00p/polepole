import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, shadow } from '../theme';
import SpeakButton from './SpeakButton';
import { speakSwahili } from '../lib/speak';
import { useAuth } from '../context/AuthContext';
import { lessonStrings, tableLanguageColumns, speakable } from '../lib/lessonStrings';

// Lesson table. Columns written in the language being learned get a 🔊 on
// every cell, and tables with a recall pair (word ↔ meaning, present ↔ past…)
// get a self-test mode: hide either column, recall it, tap to check.
// Which columns qualify is decided from the headers in lib/lessonStrings.js.
export default function LessonTable({ block }) {
  const { user } = useAuth();
  const t = lessonStrings(user?.course);
  const headers = block.tableHeaders || [];
  const rows = block.tableRows || [];
  const { targetCol, knownCol, speakCols } = tableLanguageColumns(headers, user?.course);
  const canTest = targetCol >= 0 && knownCol >= 0;

  const [hiddenCol, setHiddenCol] = useState(-1);
  const [revealed, setRevealed] = useState(() => new Set());

  const setMode = (col) => { setHiddenCol(col); setRevealed(new Set()); };
  const reveal = (ri, cell) => {
    setRevealed((s) => new Set(s).add(ri));
    if (speakCols.has(hiddenCol)) speakSwahili(speakable(cell));
  };

  // Four or more columns on a phone leaves ~55pt of text per cell at the
  // normal padding, which breaks ordinary words mid-word.
  const dense = headers.length >= 4;

  const modeChip = (col, label) => (
    <Pressable
      key={col}
      onPress={() => setMode(col)}
      accessibilityRole="button"
      accessibilityState={{ selected: hiddenCol === col }}
      style={[styles.mode, hiddenCol === col && styles.modeActive]}
    >
      <Text style={[styles.modeText, hiddenCol === col && styles.modeTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.block}>
      {canTest && (
        <View style={styles.bar}>
          {modeChip(-1, t.showAll)}
          {modeChip(knownCol, t.hide(headers[knownCol]))}
          {modeChip(targetCol, t.hide(headers[targetCol]))}
        </View>
      )}
      <View style={styles.table}>
        <View style={[styles.tr, styles.theadRow]}>
          {headers.map((h, i) => (
            <View key={i} style={[styles.cell, dense && styles.cellDense]}>
              <Text style={[styles.th, dense && styles.textDense]}>{h}</Text>
            </View>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View key={ri} style={[styles.tr, ri % 2 === 1 && styles.trAlt]}>
            {row.map((c, ci) => {
              const cellStyle = [styles.cell, dense && styles.cellDense];
              if (ci === hiddenCol && !revealed.has(ri)) {
                return (
                  <View key={ci} style={cellStyle}>
                    <Pressable onPress={() => reveal(ri, c)} style={styles.cover} accessibilityRole="button">
                      <Text style={styles.coverText}>{t.tapToReveal}</Text>
                    </Pressable>
                  </View>
                );
              }
              const text = <Text style={[styles.td, ci === 0 && styles.tdFirst, dense && styles.textDense, { flex: 1 }]}>{c}</Text>;
              return (
                <View key={ci} style={[cellStyle, styles.cellRow]}>
                  {text}
                  {speakCols.has(ci) && <SpeakButton text={speakable(c)} size="sm" />}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      {hiddenCol !== -1 && <Text style={styles.hint}>{t.tableHint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 20 },
  bar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  mode: { borderWidth: 1.5, borderColor: colors.line, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13 },
  modeActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  modeText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  modeTextActive: { color: '#fff' },

  table: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, ...shadow },
  tr: { flexDirection: 'row' },
  theadRow: { backgroundColor: colors.teal },
  trAlt: { backgroundColor: colors.light },
  cell: { flex: 1, paddingVertical: 9, paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: colors.line, justifyContent: 'center' },
  cellRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cellDense: { paddingHorizontal: 7 },
  textDense: { fontSize: 12.5 },
  th: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
  td: { color: colors.ink, fontSize: 14 },
  tdFirst: { fontWeight: '700', color: colors.navy },

  cover: { alignSelf: 'flex-start', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.gold, backgroundColor: colors.goldTint, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 11 },
  coverText: { color: '#8a5c05', fontSize: 12.5, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 13, marginTop: 8 },
});
