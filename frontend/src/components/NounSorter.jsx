import { useState } from 'react';
import { speakSwahili, isSpeechSupported } from '../lib/speak';

// Interactive noun-class explorer for the "Noun Classes" lessons.
// Tap a noun → see its class, its plural, and how it changes the verb.
// block.mode picks the set: 'set1' (M/WA + M/MI, lesson 8) | 'set2' (KI/VI + N, lesson 9).
// Reuses the .vb-* builder styles; verb-prefix examples highlight in gold ([..]).

const SETS = {
  set1: [
    { sing: 'mtu', pl: 'watu', en: 'person', cls: 'M/WA', note: 'people', ex: 'Mtu [a]nacheza · Watu [wa]nacheza', exEn: 'a person plays · people play' },
    { sing: 'mtoto', pl: 'watoto', en: 'child', cls: 'M/WA', note: 'people', ex: 'Mtoto [a]nalala · Watoto [wa]nalala', exEn: 'a child sleeps · children sleep' },
    { sing: 'mti', pl: 'miti', en: 'tree', cls: 'M/MI', note: 'plants & things', ex: 'Mti [u]naanguka · Miti [i]naanguka', exEn: 'a tree falls · trees fall' },
    { sing: 'mlango', pl: 'milango', en: 'door', cls: 'M/MI', note: 'plants & things', ex: 'Mlango [u]nafunguka · Milango [i]nafunguka', exEn: 'a door opens · doors open' },
  ],
  set2: [
    { sing: 'kitabu', pl: 'vitabu', en: 'book', cls: 'KI/VI', note: 'things', ex: 'Kitabu [ki]nasomwa · Vitabu [vi]nasomwa', exEn: 'a book is read · books are read' },
    { sing: 'kiti', pl: 'viti', en: 'chair', cls: 'KI/VI', note: 'things', ex: 'Kiti [ki]mevunjika · Viti [vi]mevunjika', exEn: 'a chair is broken · chairs are broken' },
    { sing: 'nyumba', pl: 'nyumba', en: 'house', cls: 'N', note: 'same sing & plural', ex: 'Nyumba [i]najengwa · Nyumba [zi]najengwa', exEn: 'a house is built · houses are built' },
    { sing: 'simu', pl: 'simu', en: 'phone', cls: 'N', note: 'same sing & plural', ex: 'Simu [i]nalia · Simu [zi]nalia', exEn: 'a phone rings · phones ring' },
  ],
};

function segments(ex) {
  return ex.split(/(\[[^\]]*\])/).filter(Boolean).map((part) =>
    part.startsWith('[') && part.endsWith(']') ? { text: part.slice(1, -1), hl: true } : { text: part, hl: false }
  );
}

export default function NounSorter({ block = {} }) {
  const nouns = block.nouns || SETS[block.mode] || SETS.set1;
  const [i, setI] = useState(0);
  const n = nouns[i];

  return (
    <div className="block">
      <div className="vb">
        <div className="vb-title">{block.calloutTitle || 'Sort the noun'}</div>
        {block.intro && <p className="vb-intro">{block.intro}</p>}

        <div className="vb-step">
          <div className="vb-step-label"><span className="vb-dot vb-dot-stem" /> Tap a noun</div>
          <div className="vb-pills">
            {nouns.map((item, idx) => (
              <button key={item.sing} className={`vb-pill ${idx === i ? 'active stem' : ''}`} onClick={() => setI(idx)}>
                <span className="vb-pill-sw">{item.sing}</span>
                <span className="vb-pill-en">{item.en}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="vb-result">
          <span className="vb-ns-badge">{n.cls} · {n.note}</span>
          <div className="vb-word-row">
            <div className="vb-word">
              <span className="vb-t-stem">{n.sing}</span>
              <span className="vb-arrow">→</span>
              <span className="vb-t-stem">{n.pl}</span>
            </div>
            {isSpeechSupported() && (
              <button type="button" className="vb-speak" onClick={() => speakSwahili(`${n.sing}, ${n.pl}`)} title="Hear it — pole pole" aria-label={`Hear ${n.sing}, ${n.pl}`}>🔊</button>
            )}
          </div>
          <div className="vb-en">“{n.en} → {n.en}s”</div>
          <div className="vb-ns-verb">
            {segments(n.ex).map((s, k) => (
              <span key={k} className={s.hl ? 'vb-t-mark' : undefined}>{s.text}</span>
            ))}
          </div>
          <div className="vb-en-alt">{n.exEn}</div>
        </div>
      </div>
    </div>
  );
}
