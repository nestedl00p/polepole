import { useEffect, useState } from 'react';
import { api } from '../api/client';
import SpeakButton from '../components/SpeakButton';

export default function Flashcards() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState('cards'); // 'cards' | 'practice'
  // "Nitakumbuka hii": the learner's own deck inside the course's.
  const [pinnedOnly, setPinnedOnly] = useState(false);

  // practice state
  const [pq, setPq] = useState([]);
  const [pi, setPi] = useState(0);
  const [pSel, setPSel] = useState(null);
  const [pScore, setPScore] = useState(0);
  const [pDone, setPDone] = useState(false);

  useEffect(() => {
    api.flashcards().then((d) => setCards(d.cards || [])).finally(() => setLoading(false));
  }, []);

  const startPractice = async () => {
    const d = await api.practice(10);
    setPq(d.questions || []);
    setPi(0); setPSel(null); setPScore(0); setPDone(false);
    setMode('practice');
  };

  if (loading) return <div className="spinner" />;

  if (cards.length === 0) {
    return (
      <div className="container page narrow">
        <div className="card" style={{ textAlign: 'center' }}>
          <h1 className="auth-title">Flashcards</h1>
          <p className="muted mt">Study a lesson first to start building your flashcard deck. Every word you learn appears here automatically.</p>
        </div>
      </div>
    );
  }

  // ---- Practice mode ----
  if (mode === 'practice') {
    if (pDone) {
      return (
        <div className="container page narrow">
          <div className="card result-card">
            <div className="result-score">{pScore}/{pq.length}</div>
            <div className="result-pass">Practice complete! 🎉</div>
            <div className="row center mt" style={{ gap: 12 }}>
              <button className="btn btn-primary" onClick={startPractice}>Practice again</button>
              <button className="btn btn-ghost" onClick={() => setMode('cards')}>Back to cards</button>
            </div>
          </div>
        </div>
      );
    }
    const cur = pq[pi];
    const pick = (opt) => {
      if (pSel !== null) return;
      setPSel(opt);
      if (opt === cur.answer) setPScore((s) => s + 1);
    };
    const nextP = () => {
      if (pi + 1 >= pq.length) setPDone(true);
      else { setPi((x) => x + 1); setPSel(null); }
    };
    return (
      <div className="container page narrow">
        <div className="quiz-progress">Practice · {pi + 1} of {pq.length}</div>
        <div className="progress-bar mb"><span style={{ width: `${((pi + 1) / pq.length) * 100}%` }} /></div>
        <div className="question-card">
          <div className="question-prompt">{cur.prompt}</div>
          {cur.options.map((opt, idx) => {
            let cls = 'option';
            if (pSel !== null) {
              if (opt === cur.answer) cls += ' correct';
              else if (opt === pSel) cls += ' wrong';
            }
            return <button key={idx} className={cls} onClick={() => pick(opt)}>{opt}</button>;
          })}
          {pSel !== null && (
            <button className="btn btn-primary mt btn-block" onClick={nextP}>
              {pi + 1 >= pq.length ? 'See results' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---- Card mode ----
  const pinnedCount = cards.filter((c) => c.pinned).length;
  // Unpinning the last pinned card drops back to the whole deck rather than
  // leaving an empty one on screen.
  const deck = pinnedOnly && pinnedCount > 0 ? cards.filter((c) => c.pinned) : cards;
  const card = deck[i % deck.length];

  const togglePin = async (e) => {
    e.stopPropagation(); // the card itself flips on click
    const key = card.target ?? card.swahili;
    try {
      const res = await api.pinCard(key, !card.pinned);
      // The same word can sit in more than one lesson; it is one card.
      setCards((all) => all.map((c) => ((c.target ?? c.swahili) === key ? { ...c, pinned: res.pinned } : c)));
    } catch {
      /* leave it as it was */
    }
  };
  // `target` is the word being learned (front, and what 🔊 speaks); `source` is
  // its translation. The API sets them per course direction.
  const target = card.target ?? card.swahili;
  const source = card.source ?? card.english;
  const go = (delta) => { setFlipped(false); setI((x) => ((x % deck.length) + delta + deck.length) % deck.length); };

  return (
    <div className="container page narrow">
      <div className="page-head" style={{ textAlign: 'center' }}>
        <h1>Flashcards</h1>
        <p>{deck.length} {pinnedOnly && pinnedCount > 0 ? 'pinned' : 'words from your lessons'} · Card {(i % deck.length) + 1}</p>
        {pinnedCount > 0 && (
          <button
            className={`btn btn-ghost btn-sm deck-filter ${pinnedOnly ? 'active' : ''}`}
            aria-pressed={pinnedOnly}
            onClick={() => { setPinnedOnly((p) => !p); setI(0); setFlipped(false); }}
          >
            📌 {pinnedOnly ? 'Showing pinned' : `Pinned only (${pinnedCount})`}
          </button>
        )}
      </div>

      <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
        <div className="flashcard-inner">
          <div className="flashcard-face flashcard-front">
            <div className="flashcard-speak"><SpeakButton text={target} variant="onDark" /></div>
            <div className="big">{target}</div>
            <div className="tiny">Tap to reveal · {card.lessonTitle}</div>
          </div>
          <div className="flashcard-face flashcard-back">
            <div className="flashcard-speak"><SpeakButton text={target} variant="onDark" /></div>
            <div className="big">{source}</div>
            <div className="tiny">{target}</div>
          </div>
        </div>
      </div>

      <div className="row center" style={{ gap: 12 }}>
        <button className="btn btn-ghost" onClick={() => go(-1)}>← Previous</button>
        <button className={`dose-pin ${card.pinned ? 'on' : ''}`} aria-pressed={!!card.pinned} onClick={togglePin}>
          📌 {card.pinned ? 'Pinned' : 'Pin'}
        </button>
        <button className="btn btn-ghost" onClick={() => go(1)}>Next →</button>
      </div>

      <div className="card mt" style={{ textAlign: 'center' }}>
        <p className="mb"><strong>Test your memory</strong> with a quick 10-question mixed practice quiz.</p>
        <button className="btn btn-gold" onClick={startPractice}>Start practice quiz →</button>
      </div>
    </div>
  );
}
