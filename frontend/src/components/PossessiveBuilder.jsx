import { useState } from 'react';
import { speakSwahili, isSpeechSupported } from '../lib/speak';

// Interactive Swahili possessive builder.
// Teaches the noun-class "link" (concord): possessive = NOUN + linkₐgᵣₑₑ + STEM.
// The stem (whose) never changes; the link changes with the noun's class.
// Reuses the .vb-* builder styles (noun = navy/stem, link = gold/mark, whose = teal/sub).

const NOUNS = [
  { noun: 'mtoto', en: 'child', concord: 'w', cls: 'M/WA' },
  { noun: 'watoto', en: 'children', concord: 'w', cls: 'M/WA pl' },
  { noun: 'mti', en: 'tree', concord: 'w', cls: 'M/MI' },
  { noun: 'miti', en: 'trees', concord: 'y', cls: 'M/MI pl' },
  { noun: 'kitabu', en: 'book', concord: 'ch', cls: 'KI/VI' },
  { noun: 'vitabu', en: 'books', concord: 'vy', cls: 'KI/VI pl' },
  { noun: 'gari', en: 'car', concord: 'l', cls: 'JI/MA' },
  { noun: 'magari', en: 'cars', concord: 'y', cls: 'JI/MA pl' },
  { noun: 'rafiki', en: 'friend', concord: 'y', cls: 'N' },
  { noun: 'nyumba', en: 'house', concord: 'y', cls: 'N' },
  { noun: 'ndizi', en: 'bananas', concord: 'z', cls: 'N pl' },
  { noun: 'uso', en: 'face', concord: 'w', cls: 'U' },
];

const POSSESSORS = [
  { stem: 'angu', en: 'my' },
  { stem: 'ako', en: 'your' },
  { stem: 'ake', en: 'his / her' },
  { stem: 'etu', en: 'our' },
  { stem: 'enu', en: 'your (pl)' },
  { stem: 'ao', en: 'their' },
];

export default function PossessiveBuilder({ block = {} }) {
  const nouns = block.nouns || NOUNS;
  const possessors = block.possessors || POSSESSORS;

  const [ni, setNi] = useState(4); // kitabu — shows the interesting "ch" link
  const [pi, setPi] = useState(0);
  const noun = nouns[ni];
  const poss = possessors[pi];

  const word = `${noun.noun} ${noun.concord}${poss.stem}`;
  const english = `${poss.en} ${noun.en}`;

  const steps = [
    { accent: 'stem', label: '1 · Which thing?', options: nouns.map((n) => ({ sw: n.noun, en: n.en })), index: ni, set: setNi },
    { accent: 'sub', label: '2 · Whose is it?', options: possessors.map((p) => ({ sw: `-${p.stem}`, en: p.en })), index: pi, set: setPi },
  ];

  const pieces = [
    { text: noun.noun, role: 'stem', tag: `noun · ${noun.cls}` },
    { text: noun.concord, role: 'mark', tag: 'link' },
    { text: poss.stem, role: 'sub', tag: 'whose' },
  ];

  return (
    <div className="block">
      <div className="vb">
        <div className="vb-title">{block.calloutTitle || 'Build a possessive: NOUN + link + stem'}</div>
        <p className="vb-intro">
          {block.intro ||
            'A possessive has two parts: a stem that says whose it is, and a “link” that must agree with the noun’s class. The stem never changes — only the link does. Pick a noun and an owner and watch the link adjust.'}
        </p>

        {steps.map((step, idx) => (
          <div className="vb-step" key={idx}>
            <div className="vb-step-label"><span className={`vb-dot vb-dot-${step.accent}`} /> {step.label}</div>
            <div className="vb-pills">
              {step.options.map((o, i) => (
                <button
                  key={o.sw}
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

        {/* Live formula */}
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

        {/* Result */}
        <div className="vb-result">
          <div className="vb-word-row">
            <div className="vb-word">
              <span className="vb-t-stem">{noun.noun}</span>{' '}
              <span className="vb-t-mark">{noun.concord}</span><span className="vb-t-sub">{poss.stem}</span>
            </div>
            {isSpeechSupported() && (
              <button type="button" className="vb-speak" onClick={() => speakSwahili(word)} title="Hear it — pole pole" aria-label={`Hear ${word} spoken`}>🔊</button>
            )}
          </div>
          <div className="vb-en">“{english}”</div>
        </div>
      </div>
    </div>
  );
}
