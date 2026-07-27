import { useState } from 'react';
import { speakSwahili, isSpeechSupported } from '../lib/speak';

// Interactive English article builder — a / an / the.
// Swahili has no articles at all, so this is the single biggest hurdle for a
// Swahili-speaking learner. The rule is about the SOUND the noun starts with,
// not the letter: "an hour" (silent h), "a university" (sounds like "yu").
// Labels are in Swahili because this course is taught in Swahili.

const NOUNS = [
  { word: 'book', sw: 'kitabu', a: 'a', why: 'Inaanza na sauti ya konsonanti (b).' },
  { word: 'apple', sw: 'tufaha', a: 'an', why: 'Inaanza na sauti ya vokali (a).' },
  { word: 'house', sw: 'nyumba', a: 'a', why: 'Inaanza na sauti ya konsonanti (h).' },
  { word: 'egg', sw: 'yai', a: 'an', why: 'Inaanza na sauti ya vokali (e).' },
  { word: 'orange', sw: 'chungwa', a: 'an', why: 'Inaanza na sauti ya vokali (o).' },
  { word: 'car', sw: 'gari', a: 'a', why: 'Inaanza na sauti ya konsonanti (k).' },
  { word: 'umbrella', sw: 'mwavuli', a: 'an', why: 'Inaanza na sauti ya vokali (u).' },
  { word: 'hour', sw: 'saa', a: 'an', why: 'Herufi "h" haisikiki — inasikika kama "aua".' },
  { word: 'university', sw: 'chuo kikuu', a: 'a', why: 'Inasikika kama "yunivesiti" — sauti ya "y".' },
];

const FORMS = [
  { id: 'a', label: 'a / an', sw: 'kitu chochote (si maalum)' },
  { id: 'the', label: 'the', sw: 'kitu maalum, tunachokijua' },
];

export default function ArticleBuilder({ block = {} }) {
  const nouns = block.nouns || NOUNS;
  const [ni, setNi] = useState(0);
  const [fi, setFi] = useState(0);

  const noun = nouns[ni];
  const definite = FORMS[fi].id === 'the';
  const article = definite ? 'the' : noun.a;
  const phrase = `${article} ${noun.word}`;

  const steps = [
    {
      accent: 'stem',
      label: '1 · Chagua nomino',
      options: nouns.map((n) => ({ sw: n.word, en: n.sw })),
      index: ni, set: setNi,
    },
    {
      accent: 'sub',
      label: '2 · Maalum au la?',
      options: FORMS.map((f) => ({ sw: f.label, en: f.sw })),
      index: fi, set: setFi,
    },
  ];

  const pieces = [
    { text: article, role: 'mark', tag: definite ? 'maalum' : 'si maalum' },
    { text: noun.word, role: 'stem', tag: 'nomino' },
  ];

  return (
    <div className="block">
      <div className="vb">
        <div className="vb-title">{block.calloutTitle || 'Jenga: a / an / the'}</div>
        <p className="vb-intro">
          {block.intro ||
            'Kiswahili hakina "a", "an" wala "the" — lakini Kiingereza kinahitaji. Tumia "a/an" kwa kitu chochote, na "the" kwa kitu maalum. Kumbuka: "an" hutumika mbele ya SAUTI ya vokali, si herufi tu.'}
        </p>

        {steps.map((step, idx) => (
          <div className="vb-step" key={idx}>
            <div className="vb-step-label"><span className={`vb-dot vb-dot-${step.accent}`} /> {step.label}</div>
            <div className="vb-pills">
              {step.options.map((o, i) => (
                <button
                  key={o.sw}
                  type="button"
                  className={`vb-pill ${i === step.index ? `active ${step.accent}` : ''}`}
                  onClick={() => step.set(i)}
                >
                  <span className="vb-pill-sw">{o.sw}</span>
                  <span className="vb-pill-en">{o.en}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="vb-formula">
          {pieces.map((p, i) => (
            <span className="vb-frag" key={i}>
              {i > 0 && <span className="vb-plus">+</span>}
              <span className={`vb-piece vb-${p.role}`}>
                <span className="vb-piece-tag">{p.tag}</span>
                <span className="vb-piece-val">{p.text}</span>
              </span>
            </span>
          ))}
          <span className="vb-eq">=</span>
        </div>

        <div className="vb-result">
          <div className="vb-word-row">
            <div className="vb-word">
              <span className="vb-t-mark">{article}</span>{' '}
              <span className="vb-t-stem">{noun.word}</span>
            </div>
            {isSpeechSupported() && (
              <button type="button" className="vb-speak" onClick={() => speakSwahili(phrase)}
                title="Sikiliza" aria-label={`Sikiliza ${phrase}`}>🔊</button>
            )}
          </div>
          <div className="vb-en">“{noun.sw}”</div>
          {!definite && <div className="vb-qtip">💡 {noun.why}</div>}
          {definite && <div className="vb-qtip">💡 "the" haibadiliki kamwe — ni sawa kwa kila nomino.</div>}
        </div>
      </div>
    </div>
  );
}
