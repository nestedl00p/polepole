import { useState } from 'react';
import { speakSwahili, isSpeechSupported } from '../lib/speak';

// Interactive English verb builder, taught in Swahili.
// Driven by block.mode:
//   toBe      — I am / you are / he is        (Kiswahili hutumia "ni" kwa wote)
//   present   — I work / he workS             (the 3rd-person -s)
//   past      — regular -ed vs irregular
//   future    — will + verb (haibadiliki)
//   negative  — don't / doesn't + verb
//
// The English/Swahili mirror image of VerbBuilder: there the interesting part is
// the prefix, here it's the ending (and the fact that only "he/she/it" changes).

const VERBS = {
  work:  { sw: 'fanya kazi', past: 'worked',  irregular: false },
  read:  { sw: 'soma',       past: 'read',    irregular: true },
  eat:   { sw: 'kula',       past: 'ate',     irregular: true },
  go:    { sw: 'enda',       past: 'went',    irregular: true },
  want:  { sw: 'taka',       past: 'wanted',  irregular: false },
  play:  { sw: 'cheza',      past: 'played',  irregular: false },
  see:   { sw: 'ona',        past: 'saw',     irregular: true },
  speak: { sw: 'sema',       past: 'spoke',   irregular: true },
};

const SUBJECTS = [
  { en: 'I',        sw: 'mimi',        be: 'am',  third: false },
  { en: 'You',      sw: 'wewe',        be: 'are', third: false },
  { en: 'He / She', sw: 'yeye',        be: 'is',  third: true },
  { en: 'We',       sw: 'sisi',        be: 'are', third: false },
  { en: 'They',     sw: 'wao',         be: 'are', third: false },
];

// "he goes", "he watches" — verbs ending in o/ch/sh/s/x take -es.
function thirdPerson(verb) {
  if (/(o|ch|sh|s|x)$/.test(verb)) return verb + 'es';
  if (/[^aeiou]y$/.test(verb)) return verb.slice(0, -1) + 'ies';
  return verb + 's';
}

export default function EnglishVerbBuilder({ block = {} }) {
  const mode = block.mode || 'present';
  const verbKeys = block.verbKeys || ['work', 'read', 'eat', 'go', 'want', 'speak'];
  const verbs = verbKeys.map((k) => ({ key: k, ...VERBS[k] })).filter((v) => v.sw);

  const [si, setSi] = useState(0);
  const [vi, setVi] = useState(0);
  const subj = SUBJECTS[si];
  const verb = verbs[vi] || verbs[0];

  let pieces;
  let swahili;
  let tip = null;

  if (mode === 'toBe') {
    pieces = [
      { text: subj.en, role: 'sub', tag: 'nani' },
      { text: subj.be, role: 'mark', tag: 'kuwa' },
    ];
    swahili = `${subj.sw} ni…`;
    tip = 'Kiswahili hutumia "ni" kwa kila mtu. Kiingereza kina maumbo matatu: am / is / are.';
  } else if (mode === 'past') {
    const form = verb.past;
    pieces = [
      { text: subj.en, role: 'sub', tag: 'nani' },
      { text: form, role: 'stem', tag: verb.irregular ? 'kipekee' : '+ed' },
    ];
    swahili = `${subj.sw} ali${verb.sw}`;
    tip = verb.irregular
      ? `"${verb.key}" ni kitenzi cha kipekee — hakiongezi "-ed". Lazima ukariri: ${verb.key} → ${form}.`
      : 'Vitenzi vya kawaida huongeza "-ed" kwa wakati uliopita — kwa kila mtu, bila mabadiliko.';
  } else if (mode === 'future') {
    pieces = [
      { text: subj.en, role: 'sub', tag: 'nani' },
      { text: 'will', role: 'mark', tag: 'ta-' },
      { text: verb.key, role: 'stem', tag: 'kitenzi' },
    ];
    swahili = `${subj.sw} ata${verb.sw}`;
    tip = '"will" haibadiliki kamwe, na kitenzi hubaki kama kilivyo. Rahisi!';
  } else if (mode === 'negative') {
    const aux = subj.third ? "doesn't" : "don't";
    pieces = [
      { text: subj.en, role: 'sub', tag: 'nani' },
      { text: aux, role: 'neg', tag: 'si-' },
      { text: verb.key, role: 'stem', tag: 'kitenzi' },
    ];
    swahili = `${subj.sw} ha${verb.sw}`;
    tip = subj.third
      ? 'Kwa he/she/it tumia "doesn\'t" — na kitenzi HAKICHUKUI "-s" (doesn\'t works ✗).'
      : 'Tumia "don\'t" kwa I / you / we / they.';
  } else {
    const form = subj.third ? thirdPerson(verb.key) : verb.key;
    pieces = [
      { text: subj.en, role: 'sub', tag: 'nani' },
      { text: form, role: 'stem', tag: subj.third ? '+s' : 'kitenzi' },
    ];
    swahili = `${subj.sw} ana${verb.sw}`;
    tip = subj.third
      ? 'Kwa he / she / it PEKEE, kitenzi huongeza "-s". Hii ndiyo kanuni inayosahaulika zaidi.'
      : 'Kwa I / you / we / they kitenzi hakibadiliki hata kidogo.';
  }

  const phrase = pieces.map((p) => p.text).join(' ');

  const steps = [
    {
      accent: 'sub',
      label: '1 · Nani?',
      options: SUBJECTS.map((s) => ({ sw: s.en, en: s.sw })),
      index: si, set: setSi,
    },
  ];
  if (mode !== 'toBe') {
    steps.push({
      accent: 'stem',
      label: '2 · Kitenzi gani?',
      options: verbs.map((v) => ({ sw: v.key, en: v.sw })),
      index: vi, set: setVi,
    });
  }

  return (
    <div className="block">
      <div className={`vb vb-${mode === 'negative' ? 'negative' : ''}`}>
        <div className="vb-title">{block.calloutTitle || 'Jenga sentensi ya Kiingereza'}</div>
        {block.intro && <p className="vb-intro">{block.intro}</p>}

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
              {pieces.map((p, i) => (
                <span key={i} className={`vb-t-${p.role}`}>{i > 0 ? ' ' : ''}{p.text}</span>
              ))}
            </div>
            {isSpeechSupported() && (
              <button type="button" className="vb-speak" onClick={() => speakSwahili(phrase)}
                title="Sikiliza" aria-label={`Sikiliza ${phrase}`}>🔊</button>
            )}
          </div>
          <div className="vb-en">“{swahili}”</div>
          {tip && <div className="vb-qtip">💡 {tip}</div>}
        </div>
      </div>
    </div>
  );
}
