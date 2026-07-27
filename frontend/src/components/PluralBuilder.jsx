import { useState } from 'react';
import { speakSwahili, isSpeechSupported } from '../lib/speak';

// Interactive English plural builder — singular → plural.
// Swahili marks plural with a class prefix (mtu → watu); English adds a suffix
// and has a short list of irregulars that must be memorised.

const NOUNS = [
  { sing: 'book', plural: 'books', sw: 'kitabu / vitabu', rule: '+s', why: 'Nyingi huongeza "-s" tu.' },
  { sing: 'car', plural: 'cars', sw: 'gari / magari', rule: '+s', why: 'Nyingi huongeza "-s" tu.' },
  { sing: 'box', plural: 'boxes', sw: 'sanduku / masanduku', rule: '+es', why: 'Inaishia -x, -s, -ch, -sh → ongeza "-es".' },
  { sing: 'watch', plural: 'watches', sw: 'saa / saa', rule: '+es', why: 'Inaishia -ch → ongeza "-es".' },
  { sing: 'baby', plural: 'babies', sw: 'mtoto / watoto', rule: 'y → ies', why: 'Konsonanti + y → badilisha y kuwa "-ies".' },
  { sing: 'city', plural: 'cities', sw: 'jiji / majiji', rule: 'y → ies', why: 'Konsonanti + y → badilisha y kuwa "-ies".' },
  { sing: 'child', plural: 'children', sw: 'mtoto / watoto', rule: 'kipekee', why: 'Haifuati kanuni — lazima ukariri.' },
  { sing: 'man', plural: 'men', sw: 'mwanamume / wanaume', rule: 'kipekee', why: 'Haifuati kanuni — lazima ukariri.' },
  { sing: 'woman', plural: 'women', sw: 'mwanamke / wanawake', rule: 'kipekee', why: 'Haifuati kanuni — lazima ukariri.' },
  { sing: 'foot', plural: 'feet', sw: 'mguu / miguu', rule: 'kipekee', why: 'Haifuati kanuni — lazima ukariri.' },
  { sing: 'fish', plural: 'fish', sw: 'samaki / samaki', rule: 'haibadiliki', why: 'Umoja na wingi ni sawa — kama "samaki".' },
];

// Splits the plural so the changed ending can be highlighted.
function split(sing, plural) {
  let i = 0;
  while (i < sing.length && i < plural.length && sing[i] === plural[i]) i++;
  return { head: plural.slice(0, i), tail: plural.slice(i) };
}

export default function PluralBuilder({ block = {} }) {
  const nouns = block.nouns || NOUNS;
  const [i, setI] = useState(0);
  const n = nouns[i];
  const { head, tail } = split(n.sing, n.plural);

  return (
    <div className="block">
      <div className="vb">
        <div className="vb-title">{block.calloutTitle || 'Umoja → Wingi'}</div>
        <p className="vb-intro">
          {block.intro ||
            'Kiswahili hubadilisha mwanzo wa neno (mtu → watu). Kiingereza hubadilisha mwisho — mara nyingi kwa "-s". Lakini kuna maneno ya kipekee ambayo lazima ukariri.'}
        </p>

        <div className="vb-step">
          <div className="vb-step-label"><span className="vb-dot vb-dot-stem" /> Gusa nomino</div>
          <div className="vb-pills">
            {nouns.map((item, idx) => (
              <button
                key={item.sing}
                type="button"
                className={`vb-pill ${idx === i ? 'active stem' : ''}`}
                onClick={() => setI(idx)}
              >
                <span className="vb-pill-sw">{item.sing}</span>
                <span className="vb-pill-en">{item.rule}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="vb-result">
          <span className="vb-ns-badge">{n.rule}</span>
          <div className="vb-word-row">
            <div className="vb-word">
              <span className="vb-t-stem">{n.sing}</span>
              <span className="vb-ns-arrow">  →  </span>
              <span className="vb-t-stem">{head}</span><span className="vb-t-mark">{tail}</span>
            </div>
            {isSpeechSupported() && (
              <button type="button" className="vb-speak"
                onClick={() => speakSwahili(`${n.sing}, ${n.plural}`)}
                title="Sikiliza" aria-label={`Sikiliza ${n.sing}, ${n.plural}`}>🔊</button>
            )}
          </div>
          <div className="vb-en">“{n.sw}”</div>
          <div className="vb-qtip">💡 {n.why}</div>
        </div>
      </div>
    </div>
  );
}
