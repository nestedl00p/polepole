import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import VerbBuilder from './VerbBuilder';
import PossessiveBuilder from './PossessiveBuilder';
import QuestionBuilder from './QuestionBuilder';
import AdjectiveBuilder from './AdjectiveBuilder';
import NounSorter from './NounSorter';
import SentenceBuilder from './SentenceBuilder';
import PronunciationDrill from './PronunciationDrill';
import LessonTable from './LessonTable';
import Dialogue from './Dialogue';
import QuickCheck from './QuickCheck';
// English-course builders (the Swahili concord builders have no English analogue).
import ArticleBuilder from './ArticleBuilder';
import PluralBuilder from './PluralBuilder';
import EnglishVerbBuilder from './EnglishVerbBuilder';

// Renders a single lesson content block.
// Static types: heading, paragraph, callout, list.
// Interactive types: table, dialogue, quickCheck, verbBuilder, possessiveBuilder, questionBuilder,
// adjectiveBuilder, nounSorter, sentenceBuilder, pronunciationDrill.
// New block types must be registered BOTH here and in the web ContentBlock.jsx.
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

    case 'articleBuilder':
      return <ArticleBuilder block={block} />;

    case 'pluralBuilder':
      return <PluralBuilder block={block} />;

    case 'englishVerbBuilder':
      return <EnglishVerbBuilder block={block} />;

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
      return <LessonTable block={block} />;

    case 'dialogue':
      return <Dialogue block={block} />;

    case 'quickCheck':
      return <QuickCheck block={block} />;

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
});
