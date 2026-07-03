import { useState } from 'react';
import { speakSwahili, isSpeechSupported } from '../lib/speak';

// Interactive question-word explorer. Tap a question word to see it inside a
// real sentence (the word highlighted), hear it, and learn where it sits.
// Reuses the .vb-* builder styles.

const QUESTIONS = [
  { word: 'nani', en: 'who', ex: '[Nani] anakuja?', exEn: 'Who is coming?', tip: 'subject — starts the sentence' },
  { word: 'nini', en: 'what', ex: 'Unataka [nini]?', exEn: 'What do you want?', tip: 'goes at the end' },
  { word: 'wapi', en: 'where', ex: 'Unakaa [wapi]?', exEn: 'Where do you live?', tip: 'goes at the end' },
  { word: 'lini', en: 'when', ex: 'Utasafiri [lini]?', exEn: 'When will you travel?', tip: 'goes at the end' },
  { word: 'kwa nini', en: 'why', ex: '[Kwa nini] unalia?', exEn: 'Why are you crying?', tip: 'starts the sentence' },
  { word: 'ngapi', en: 'how many', ex: 'Una vitabu [vingapi]?', exEn: 'How many books do you have?', tip: 'takes a class prefix (vi-ngapi)' },
  { word: 'gani', en: 'which', ex: 'Unapenda chai [gani]?', exEn: 'Which tea do you like?', tip: 'follows the noun' },
];

// Splits "Una vitabu [vingapi]?" into highlighted segments.
function segments(ex) {
  return ex.split(/(\[[^\]]*\])/).filter(Boolean).map((part) => {
    if (part.startsWith('[') && part.endsWith(']')) return { text: part.slice(1, -1), hl: true };
    return { text: part, hl: false };
  });
}

export default function QuestionBuilder({ block = {} }) {
  const questions = block.questions || QUESTIONS;
  const [qi, setQi] = useState(2); // wapi — a good "goes at the end" example
  const q = questions[qi];
  const plain = q.ex.replace(/[[\]]/g, '');

  return (
    <div className="block">
      <div className="vb vb-question">
        <div className="vb-title">{block.calloutTitle || 'Ask a question'}</div>
        {block.intro && <p className="vb-intro">{block.intro}</p>}

        <div className="vb-step">
          <div className="vb-step-label"><span className="vb-dot vb-dot-mark" /> Tap a question word</div>
          <div className="vb-pills">
            {questions.map((item, i) => (
              <button
                key={item.word}
                className={`vb-pill ${i === qi ? 'active mark' : ''}`}
                onClick={() => setQi(i)}
              >
                <span className="vb-pill-sw">{item.word}</span>
                <span className="vb-pill-en">{item.en}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="vb-result">
          <div className="vb-word-row">
            <div className="vb-word vb-q-sentence">
              {segments(q.ex).map((s, i) => (
                <span key={i} className={s.hl ? 'vb-t-mark' : 'vb-t-stem'}>{s.text}</span>
              ))}
            </div>
            {isSpeechSupported() && (
              <button type="button" className="vb-speak" onClick={() => speakSwahili(plain)} title="Hear it — pole pole" aria-label={`Hear ${plain} spoken`}>🔊</button>
            )}
          </div>
          <div className="vb-en">“{q.exEn}”</div>
          <div className="vb-qtip">💡 <strong>{q.word}</strong> — {q.tip}</div>
        </div>
      </div>
    </div>
  );
}
