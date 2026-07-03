import { useState } from 'react';
import { speakSwahili, isSpeechSupported } from '../lib/speak';

// Interactive Swahili word-builder for grammar "formulas".
// One component drives every construction lesson via `block.mode`:
//   tense       — SUBJECT + marker + STEM      (present/past/future/perfect)
//   negative    — NEG PREFIX + STEM(-a→-i)
//   subjunctive — SUBJECT + STEM(-a→-e)
//   object      — SUBJECT + marker + OBJECT + STEM
// Verb forms live in one dictionary; each lesson passes a curated, tense-safe
// `stemKeys` list so the builder never assembles an irregular form.

const STEM_LIB = {
  soma:   { en: 'read',   en3: 'reads',   ing: 'reading',   past: 'read',      pp: 'read' },
  penda:  { en: 'like',   en3: 'likes',   ing: 'liking',    past: 'liked',     pp: 'liked' },
  kula:   { en: 'eat',    en3: 'eats',    ing: 'eating',    past: 'ate',       pp: 'eaten' },
  kunywa: { en: 'drink',  en3: 'drinks',  ing: 'drinking',  past: 'drank',     pp: 'drunk' },
  enda:   { en: 'go',     en3: 'goes',    ing: 'going',     past: 'went',      pp: 'gone' },
  sema:   { en: 'speak',  en3: 'speaks',  ing: 'speaking',  past: 'spoke',     pp: 'spoken' },
  taka:   { en: 'want',   en3: 'wants',   ing: 'wanting',   past: 'wanted',    pp: 'wanted' },
  jua:    { en: 'know',   en3: 'knows',   ing: 'knowing',   past: 'knew',      pp: 'known' },
  ona:    { en: 'see',    en3: 'sees',    ing: 'seeing',    past: 'saw',       pp: 'seen' },
  fanya:  { en: 'do',     en3: 'does',    ing: 'doing',     past: 'did',       pp: 'done' },
  andika: { en: 'write',  en3: 'writes',  ing: 'writing',   past: 'wrote',     pp: 'written' },
  safiri: { en: 'travel', en3: 'travels', ing: 'travelling',past: 'travelled', pp: 'travelled' },
};

const SUBJECTS = [
  { prefix: 'ni', pronoun: 'I', third: false },
  { prefix: 'u', pronoun: 'You', third: false },
  { prefix: 'a', pronoun: 'He / She', third: true },
  { prefix: 'tu', pronoun: 'We', third: false },
  { prefix: 'm', pronoun: 'You all', third: false },
  { prefix: 'wa', pronoun: 'They', third: false },
];

const NEG_SUBJECTS = [
  { prefix: 'si', pronoun: 'I', third: false },
  { prefix: 'hu', pronoun: 'You', third: false },
  { prefix: 'ha', pronoun: 'He / She', third: true },
  { prefix: 'hatu', pronoun: 'We', third: false },
  { prefix: 'ham', pronoun: 'You all', third: false },
  { prefix: 'hawa', pronoun: 'They', third: false },
];

const OBJECTS = [
  { infix: 'ni', en: 'me' },
  { infix: 'ku', en: 'you' },
  { infix: 'm', en: 'him / her' },
  { infix: 'tu', en: 'us' },
  { infix: 'wa', en: 'them' },
];

const TENSE_TAG = { present: 'now', past: 'then', future: 'will', perfect: 'done' };
const DEFAULT_MARKER = { present: 'na', past: 'li', future: 'ta', perfect: 'me' };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const root = (stem) => stem.replace(/a$/, '');

export default function VerbBuilder({ block = {} }) {
  const mode = block.mode || 'tense';
  const tense = block.tense || 'present';
  const marker = block.marker || DEFAULT_MARKER[tense] || 'na';

  const stemKeys = block.stemKeys ||
    (mode === 'negative' || mode === 'subjunctive'
      ? ['soma', 'penda', 'sema', 'ona', 'taka', 'jua']
      : ['soma', 'penda', 'kula', 'kunywa', 'enda', 'sema']);
  const stems = stemKeys.map((k) => ({ stem: k, ...STEM_LIB[k] }));

  const subjectList = mode === 'negative' ? NEG_SUBJECTS : SUBJECTS;

  const [si, setSi] = useState(0);
  const [vi, setVi] = useState(0);
  const [oi, setOi] = useState(1); // default object: "you"

  const subj = subjectList[si];
  const verb = stems[vi];
  const obj = OBJECTS[oi];

  // ---- assemble swahili pieces + english per mode ----
  let pieces; // [{ text, role, tag }]
  let english;
  let englishAlt = null;

  if (mode === 'negative') {
    const form = root(verb.stem) + 'i';
    pieces = [
      { text: subj.prefix, role: 'neg', tag: 'not' },
      { text: form, role: 'stem', tag: 'verb · -a→-i' },
    ];
    english = `${subj.pronoun} ${subj.third ? "doesn't" : "don't"} ${verb.en}`;
  } else if (mode === 'subjunctive') {
    const form = root(verb.stem) + 'e';
    pieces = [
      { text: subj.prefix, role: 'sub', tag: 'who' },
      { text: form, role: 'stem', tag: 'verb · -a→-e' },
    ];
    english = subj.prefix === 'tu' ? `let's ${verb.en}` : `${subj.pronoun} should ${verb.en}`;
  } else if (mode === 'object') {
    pieces = [
      { text: subj.prefix, role: 'sub', tag: 'subject' },
      { text: marker, role: 'mark', tag: TENSE_TAG[tense] },
      { text: obj.infix, role: 'obj', tag: 'object' },
      { text: verb.stem, role: 'stem', tag: 'verb' },
    ];
    english = `${subj.pronoun} ${subj.third ? verb.en3 : verb.en} ${obj.en}`;
  } else {
    pieces = [
      { text: subj.prefix, role: 'sub', tag: 'subject' },
      { text: marker, role: 'mark', tag: TENSE_TAG[tense] },
      { text: verb.stem, role: 'stem', tag: 'action' },
    ];
    if (tense === 'present') {
      english = `${subj.pronoun} ${subj.third ? verb.en3 : verb.en}`;
      const be = subj.third ? 'is' : subj.prefix === 'ni' ? 'am' : 'are';
      englishAlt = `${subj.pronoun} ${be} ${verb.ing}`;
    } else if (tense === 'past') {
      english = `${subj.pronoun} ${verb.past}`;
      const wasWere = subj.prefix === 'ni' || subj.third ? 'was' : 'were';
      englishAlt = `${subj.pronoun} ${wasWere} ${verb.ing}`;
    } else if (tense === 'future') {
      english = `${subj.pronoun} will ${verb.en}`;
    } else if (tense === 'perfect') {
      english = `${subj.pronoun} ${subj.third ? 'has' : 'have'} ${verb.pp}`;
    }
  }

  const word = pieces.map((p) => p.text).join('');

  // Selection steps shown above the formula.
  const subjStep = {
    accent: mode === 'negative' ? 'neg' : 'sub',
    label: mode === 'negative' ? '1 · Who is NOT doing it?' : '1 · Who is doing it?',
    options: subjectList.map((s) => ({ sw: `${s.prefix}-`, en: s.pronoun })),
    index: si,
    set: setSi,
  };
  const stemStep = {
    accent: 'stem',
    label: `${mode === 'object' ? 3 : 2} · Which verb?`,
    options: stems.map((v) => ({ sw: `-${v.stem}`, en: v.en })),
    index: vi,
    set: setVi,
  };
  const objStep = mode === 'object'
    ? {
        accent: 'obj',
        label: '2 · Who receives it?',
        options: OBJECTS.map((o) => ({ sw: `-${o.infix}-`, en: o.en })),
        index: oi,
        set: setOi,
      }
    : null;

  const steps = mode === 'object' ? [subjStep, objStep, stemStep] : [subjStep, stemStep];

  return (
    <div className="block">
      <div className={`vb vb-${mode}`}>
        <div className="vb-title">{block.calloutTitle || 'Build a Swahili word'}</div>
        {block.intro && <p className="vb-intro">{block.intro}</p>}

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
              {pieces.map((p, i) => (
                <span key={i} className={`vb-t-${p.role}`}>{i === 0 ? cap(p.text) : p.text}</span>
              ))}
            </div>
            {isSpeechSupported() && (
              <button
                type="button"
                className="vb-speak"
                onClick={() => speakSwahili(word)}
                title="Hear it — pole pole"
                aria-label={`Hear ${word} spoken`}
              >
                🔊
              </button>
            )}
          </div>
          <div className="vb-en">
            “{english}”{englishAlt && <span className="vb-en-alt"> / {englishAlt}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
