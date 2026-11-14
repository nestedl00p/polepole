import { useMemo, useState } from 'react';
import { speakSwahili } from '../lib/speak';
import { useAuth } from '../context/AuthContext';
import { lessonStrings, shuffled } from '../lib/lessonStrings';

const PAIRS_PER_ROUND = 6;

// Matching game built from the lesson's own vocabulary, so every lesson gets
// one with no extra content. Tap a word, then its meaning; a match is spoken.
// pairs: [{ learning, known }]
export default function VocabMatch({ pairs }) {
  const { user } = useAuth();
  const t = lessonStrings(user?.course);
  const [round, setRound] = useState(0);
  // Keyed on the words themselves so a parent re-render doesn't reshuffle.
  const signature = pairs.map((p) => p.learning).join('|');
  const { left, right } = useMemo(() => {
    // Two words sharing a meaning would make a tile ambiguous — keep one.
    const seenL = new Set();
    const seenK = new Set();
    const unique = shuffled(pairs).filter((p) => {
      if (seenL.has(p.learning) || seenK.has(p.known)) return false;
      seenL.add(p.learning);
      seenK.add(p.known);
      return true;
    });
    const chosen = unique.slice(0, PAIRS_PER_ROUND).map((p, id) => ({ ...p, id }));
    return { left: shuffled(chosen), right: shuffled(chosen) };
  }, [signature, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const [pickL, setPickL] = useState(null);
  const [pickR, setPickR] = useState(null);
  const [matched, setMatched] = useState(() => new Set());
  const [miss, setMiss] = useState(null);   // { l, r } flashing red
  const [misses, setMisses] = useState(0);

  const tryPair = (l, r) => {
    if (l == null || r == null) return;
    if (l === r) {
      setMatched((m) => new Set(m).add(l));
      speakSwahili(left.find((p) => p.id === l).learning);
    } else {
      setMiss({ l, r });
      setMisses((n) => n + 1);
      setTimeout(() => setMiss(null), 550);
    }
    setPickL(null);
    setPickR(null);
  };

  const tapL = (id) => { if (!miss) { setPickL(id); tryPair(id, pickR); } };
  const tapR = (id) => { if (!miss) { setPickR(id); tryPair(pickL, id); } };

  const newRound = () => { setMatched(new Set()); setMisses(0); setPickL(null); setPickR(null); setRound((r) => r + 1); };
  const done = matched.size === left.length;

  const tile = (p, side, picked, onTap) => {
    const isMatched = matched.has(p.id);
    const isMiss = miss && miss[side] === p.id;
    return (
      <button
        type="button"
        key={p.id}
        className={`vm-tile ${isMatched ? 'matched' : ''} ${picked === p.id ? 'picked' : ''} ${isMiss ? 'miss qc-shake' : ''}`}
        disabled={isMatched}
        aria-pressed={picked === p.id}
        onClick={() => onTap(p.id)}
      >
        {side === 'l' ? p.learning : p.known}
      </button>
    );
  };

  return (
    <div className="vb vm mt">
      <div className="vb-title">{t.matchTitle}</div>
      <p className="vb-intro">{t.matchIntro}</p>
      <div className="vm-grid">
        <div className="vm-col">{left.map((p) => tile(p, 'l', pickL, tapL))}</div>
        <div className="vm-col">{right.map((p) => tile(p, 'r', pickR, tapR))}</div>
      </div>
      {done && (
        <div className="sb-actions">
          <span className="sb-msg sb-msg-correct">🎉 {t.matchDone} {t.matchMisses(misses)}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={newRound}>{t.newRound}</button>
        </div>
      )}
    </div>
  );
}
