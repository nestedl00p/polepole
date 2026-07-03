import { useState } from 'react';
import { speakSwahili, isSpeechSupported } from '../lib/speak';

// Interactive Swahili adjective-agreement builder: NOUN + agreement-prefix + ADJ.
// The adjective echoes the noun's class prefix. N-class triggers sound changes
// (nyumba kubwa, nyumba ndefu), so each adjective carries its exact N-form —
// the builder never assembles an incorrect word. Reuses the .vb-* styles.

const NOUNS = [
  { noun: 'mtu', en: 'person', acord: 'm', cls: 'M/WA' },
  { noun: 'watu', en: 'people', acord: 'wa', cls: 'M/WA pl' },
  { noun: 'mti', en: 'tree', acord: 'm', cls: 'M/MI' },
  { noun: 'miti', en: 'trees', acord: 'mi', cls: 'M/MI pl' },
  { noun: 'kitabu', en: 'book', acord: 'ki', cls: 'KI/VI' },
  { noun: 'vitabu', en: 'books', acord: 'vi', cls: 'KI/VI pl' },
  { noun: 'gari', en: 'car', acord: '', cls: 'JI/MA' },
  { noun: 'magari', en: 'cars', acord: 'ma', cls: 'JI/MA pl' },
  { noun: 'nyumba', en: 'house', acord: 'n', cls: 'N' },
];

const ADJECTIVES = [
  { stem: 'zuri', en: 'nice', nForm: 'nzuri' },
  { stem: 'kubwa', en: 'big', nForm: 'kubwa' },
  { stem: 'dogo', en: 'small', nForm: 'ndogo' },
  { stem: 'refu', en: 'tall', nForm: 'ndefu' },
  { stem: 'baya', en: 'bad', nForm: 'mbaya' },
  { stem: 'zito', en: 'heavy', nForm: 'nzito' },
];

function agree(acord, adj) {
  if (acord === 'n') return adj.nForm || `n${adj.stem}`;
  if (acord === '') return adj.stem; // class 5 (JI/MA singular): no prefix
  return acord + adj.stem;
}

// Split the agreed adjective into a highlightable prefix + body.
function splitAgreed(agreed, stem) {
  if (agreed.endsWith(stem) && agreed.length > stem.length) {
    return { pre: agreed.slice(0, agreed.length - stem.length), body: stem };
  }
  return { pre: '', body: agreed }; // class 5 (∅) or sound-changed (ndefu, mbaya)
}

export default function AdjectiveBuilder({ block = {} }) {
  const nouns = block.nouns || NOUNS;
  const adjectives = block.adjectives || ADJECTIVES;

  const [ni, setNi] = useState(4); // kitabu — clean ki- prefix
  const [ai, setAi] = useState(0);
  const noun = nouns[ni];
  const adj = adjectives[ai];

  const agreed = agree(noun.acord, adj);
  const { pre, body } = splitAgreed(agreed, adj.stem);
  const word = `${noun.noun} ${agreed}`;
  const english = `${adj.en} ${noun.en}`;

  const steps = [
    { accent: 'stem', label: '1 · Which thing?', options: nouns.map((n) => ({ sw: n.noun, en: n.en })), index: ni, set: setNi },
    { accent: 'sub', label: '2 · Describe it', options: adjectives.map((a) => ({ sw: `-${a.stem}`, en: a.en })), index: ai, set: setAi },
  ];

  const pieces = [
    { text: noun.noun, role: 'stem', tag: `noun · ${noun.cls}` },
    { text: pre || '∅', role: 'mark', tag: 'agree' },
    { text: adj.stem, role: 'sub', tag: 'describe' },
  ];

  return (
    <div className="block">
      <div className="vb">
        <div className="vb-title">{block.calloutTitle || 'Build a description: NOUN + prefix + adjective'}</div>
        <p className="vb-intro">
          {block.intro ||
            'The adjective comes after the noun and echoes its class prefix. Pick a noun and an adjective — watch the gold prefix copy the noun’s class. (N-class nouns blend the sound a little.)'}
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
              <span className="vb-t-stem">{noun.noun}</span>{' '}
              {pre && <span className="vb-t-mark">{pre}</span>}<span className="vb-t-sub">{body}</span>
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
