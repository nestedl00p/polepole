import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, shadow } from '../theme';
import VerbBuilder from './VerbBuilder';
import PossessiveBuilder from './PossessiveBuilder';
import QuestionBuilder from './QuestionBuilder';
import AdjectiveBuilder from './AdjectiveBuilder';
import NounSorter from './NounSorter';
import SentenceBuilder from './SentenceBuilder';
import PronunciationDrill from './PronunciationDrill';

// Renders a single lesson content block.
// Block types: heading, paragraph, callout, list, table, dialogue, verbBuilder, possessiveBuilder.
export default function ContentBlock({ block }) {
  switch (block.type) {
    case 'verbBuilder':
      return <VerbBuilder block={block} />;

    case 'possessiveBuilder':
      return <PossessiveBuilder block={block} />;

    case 'questionBuilder':
      return <QuestionBuilder block={block} />;

    case 'adjectiveBuilder':
      return <AdjectiveBuilder block={block} />;

    case 'nounSorter':
      return <NounSorter block={block} />;

    case 'sentenceBuilder':
      return <SentenceBuilder block={block} />;

    case 'pronunciationDrill':
      return <PronunciationDrill block={block} />;

    case 'heading':
      return (
        <View style={styles.block}>
          <Text style={styles.heading}>{block.heading}</Text>
        </View>
      );

    case 'paragraph':
      return (
        <View style={styles.block}>
          <Text style={styles.paragraph}>{block.text}</Text>
        </View>
      );

    case 'callout':
      return (
        <View style={styles.block}>
          <View style={styles.callout}>
            <Text style={styles.calloutTitle}>{block.calloutTitle}</Text>
            {(block.lines || []).map((l, i) => (
              <Text key={i} style={styles.calloutLine}>{l}</Text>
            ))}
          </View>
        </View>
      );

    case 'list':
      return (
        <View style={styles.block}>
          {(block.lines || []).map((l, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>{'•'}</Text>
              <Text style={styles.listText}>{l}</Text>
            </View>
          ))}
        </View>
      );

    case 'table':
      return (
        <View style={styles.block}>
          <View style={styles.table}>
            <View style={[styles.tr, styles.theadRow]}>
              {(block.tableHeaders || []).map((h, i) => (
                <View key={i} style={styles.cell}>
                  <Text style={styles.th}>{h}</Text>
                </View>
              ))}
            </View>
            {(block.tableRows || []).map((row, ri) => (
              <View key={ri} style={[styles.tr, ri % 2 === 1 && styles.trAlt]}>
                {row.map((c, ci) => (
                  <View key={ci} style={styles.cell}>
                    <Text style={[styles.td, ci === 0 && styles.tdFirst]}>{c}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      );

    case 'dialogue':
      return (
        <View style={styles.block}>
          {(block.dialogue || []).map((d, i) => (
            <View key={i} style={styles.dialogueLine}>
              <Text style={styles.dialogueTop}>
                <Text style={styles.speaker}>{d.speaker}: </Text>
                <Text style={styles.swahili}>{d.swahili}</Text>
              </Text>
              <Text style={styles.english}>{d.english}</Text>
            </View>
          ))}
        </View>
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  block: { marginBottom: 20 },
  heading: {
    fontSize: 20,
    color: colors.tealDark,
    fontWeight: '800',
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
    paddingBottom: 4,
    alignSelf: 'flex-start',
  },
  paragraph: { color: colors.ink, fontSize: 15.5, lineHeight: 24 },

  callout: {
    backgroundColor: colors.cream,
    borderLeftWidth: 5,
    borderLeftColor: colors.gold,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  calloutTitle: { fontWeight: '800', color: colors.gold, marginBottom: 6, fontSize: 15 },
  calloutLine: { color: '#44505a', marginBottom: 4, lineHeight: 22 },

  listItem: { flexDirection: 'row', marginBottom: 5, paddingLeft: 4 },
  bullet: { color: colors.teal, marginRight: 10, fontSize: 16, lineHeight: 23 },
  listText: { flex: 1, color: colors.ink, fontSize: 15.5, lineHeight: 23 },

  table: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  tr: { flexDirection: 'row' },
  theadRow: { backgroundColor: colors.teal },
  trAlt: { backgroundColor: colors.light },
  cell: { flex: 1, paddingVertical: 9, paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  th: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
  td: { color: colors.ink, fontSize: 14 },
  tdFirst: { fontWeight: '700', color: colors.navy },

  dialogueLine: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  dialogueTop: { fontSize: 15 },
  speaker: { fontWeight: '800', color: colors.tealDark },
  swahili: { fontWeight: '600', color: colors.ink },
  english: { color: colors.muted, fontSize: 13.5, fontStyle: 'italic', marginTop: 2 },
});
