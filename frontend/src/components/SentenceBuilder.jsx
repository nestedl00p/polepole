import { useState, useEffect, useRef } from 'react';
import { speakSwahili } from '../lib/speak';

// Drag-and-drop sentence builder. Reorder the scrambled word tiles into the
// correct Swahili sentence, then Check. Correct → green pop + audio; wrong → shake.

const CHALLENGES = [
  { answer: ['Huyu', 'ni', 'rafiki', 'yangu'], en: 'This is my friend' },
  { answer: ['Ana', 'watoto', 'wawili'], en: 'She has two children' },
  { answer: ['Jina', 'lake', 'ni', 'Asha'], en: 'Her name is Asha' },
  { answer: ['Watoto', 'wake', 'ni', 'wadogo'], en: 'Her children are small' },
  { answer: ['Rafiki', 'yangu', 'ni', 'mwalimu'], en: 'My friend is a teacher' },
];

function scramble(answer) {
  if (answer.length < 2) return answer.map((w, i) => ({ w, k: i }));
  let order;
  do {
    order = [...answer.keys()].sort(() => Math.random() - 0.5);
  } while (order.every((v, i) => answer[v] === answer[i]));
  return order.map((idx, i) => ({ w: answer[idx], k: `${idx}-${i}` }));
}

export default function SentenceBuilder({ block = {} }) {
  const challenges = block.challenges || CHALLENGES;
  const [ci, setCi] = useState(0);
  const [tiles, setTiles] = useState(() => scramble(challenges[0].answer));
  const [status, setStatus] = useState('idle'); // idle | correct | wrong
  const [overIdx, setOverIdx] = useState(null);
  const [done, setDone] = useState(false);
  const dragFrom = useRef(null);
  const ch = challenges[ci];

  useEffect(() => {
    setTiles(scramble(ch.answer));
    setStatus('idle');
  }, [ci]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (from, to) => {
    if (from == null || from === to) return;
    setTiles((t) => {
      const a = [...t];
      const [m] = a.splice(from, 1);
      a.splice(to, 0, m);
      return a;
    });
    setStatus('idle');
  };

  const onDrop = (i) => (e) => {
    e.preventDefault();
    move(dragFrom.current, i);
    dragFrom.current = null;
    setOverIdx(null);
  };

  const check = () => {
    if (status === 'correct') return;
    const correct = tiles.map((t) => t.w).join(' ') === ch.answer.join(' ');
    if (correct) {
      setStatus('correct');
      speakSwahili(ch.answer.join(' '));
      setTimeout(() => {
        if (ci + 1 >= challenges.length) setDone(true);
        else setCi(ci + 1);
      }, 1900);
    } else {
      setStatus('wrong');
      setTimeout(() => setStatus((s) => (s === 'wrong' ? 'idle' : s)), 650);
    }
  };

  const restart = () => { setDone(false); setCi(0); setTiles(scramble(challenges[0].answer)); setStatus('idle'); };

  if (done) {
    return (
      <div className="block">
        <div className="vb sb">
          <div className="sb-done">
            <div className="sb-done-emoji">🎉</div>
            <div className="sb-done-title">Hongera! — Well done!</div>
            <p className="sb-done-sub">You built all {challenges.length} sentences.</p>
            <button className="btn btn-primary" onClick={restart}>Build them again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="block">
      <div className="vb sb">
        <div className="vb-title">{block.calloutTitle || 'Build the sentence'}</div>
        <p className="vb-intro">{block.intro || 'Drag the words into the right order, then tap Check. Get it right to hear it spoken.'}</p>

        <div className="sb-progress">
          {challenges.map((_, i) => (
            <span key={i} className={`sb-dot ${i < ci ? 'done' : ''} ${i === ci ? 'active' : ''}`} />
          ))}
          <span className="sb-count">{ci + 1} / {challenges.length}</span>
        </div>

        <div className="sb-prompt">Say: <strong>“{ch.en}”</strong></div>

        <div className={`sb-row ${status}`}>
          {tiles.map((t, i) => (
            <span
              key={t.k}
              className={`sb-tile ${status === 'correct' ? 'correct' : ''} ${overIdx === i ? 'over' : ''}`}
              style={status === 'correct' ? { animationDelay: `${i * 90}ms` } : undefined}
              draggable={status !== 'correct'}
              onDragStart={(e) => { dragFrom.current = i; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('dragging'); }}
              onDragEnd={(e) => { e.currentTarget.classList.remove('dragging'); setOverIdx(null); }}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
              onDrop={onDrop(i)}
            >
              {t.w}
            </span>
          ))}
        </div>

        <div className="sb-actions">
          <button className="btn btn-gold" onClick={check} disabled={status === 'correct'}>Check ✓</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setTiles(scramble(ch.answer))} disabled={status === 'correct'}>Shuffle</button>
          {status === 'wrong' && <span className="sb-msg sb-msg-wrong">Not quite — try again</span>}
          {status === 'correct' && <span className="sb-msg sb-msg-correct">✓ Sawa! “{ch.en}”</span>}
        </div>
      </div>
    </div>
  );
}
