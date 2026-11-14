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

// Renders a single content block from a lesson. New block types must be
// registered BOTH here and in the mobile ContentBlock.js.
export default function ContentBlock({ block }) {
  switch (block.type) {
    case 'heading':
      return <div className="block"><h2>{block.heading}</h2></div>;

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

    case 'paragraph':
      return <div className="block"><p>{block.text}</p></div>;

    case 'callout':
      return (
        <div className="block">
          <div className="callout">
            <div className="ctitle">{block.calloutTitle}</div>
            {(block.lines || []).map((l, i) => <p key={i}>{l}</p>)}
          </div>
        </div>
      );

    case 'list':
      return (
        <div className="block">
          <ul className="sw-list">
            {(block.lines || []).map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
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
