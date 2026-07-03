import VerbBuilder from './VerbBuilder';
import PossessiveBuilder from './PossessiveBuilder';
import QuestionBuilder from './QuestionBuilder';
import AdjectiveBuilder from './AdjectiveBuilder';
import NounSorter from './NounSorter';
import SentenceBuilder from './SentenceBuilder';
import PronunciationDrill from './PronunciationDrill';

// Renders a single content block from a lesson (heading, paragraph, callout, table, dialogue, list, verbBuilder, possessiveBuilder).
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
      return (
        <div className="block">
          <table className="swtable">
            <thead>
              <tr>{(block.tableHeaders || []).map((h, i) => <th key={i}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {(block.tableRows || []).map((row, ri) => (
                <tr key={ri}>{row.map((c, ci) => <td key={ci}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'dialogue':
      return (
        <div className="block">
          {(block.dialogue || []).map((d, i) => (
            <div className="dialogue-line" key={i}>
              <span className="sp">{d.speaker}: </span>
              <span className="sw">{d.swahili}</span>
              <div className="en">{d.english}</div>
            </div>
          ))}
        </div>
      );

    default:
      return null;
  }
}
