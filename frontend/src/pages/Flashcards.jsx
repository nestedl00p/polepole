import { useEffect, useState } from 'react';
import { api } from '../api/client';
import SpeakButton from '../components/SpeakButton';

export default function Flashcards() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState('cards'); // 'cards' | 'practice'

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
  const card = cards[i];
  const go = (delta) => { setFlipped(false); setI((x) => (x + delta + cards.length) % cards.length); };

  return (
    <div className="container page narrow">
      <div className="page-head" style={{ textAlign: 'center' }}>
        <h1>Flashcards</h1>
        <p>{cards.length} words from your lessons · Card {i + 1}</p>
      </div>

      <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
        <div className="flashcard-inner">
          <div className="flashcard-face flashcard-front">
            <div className="flashcard-speak"><SpeakButton text={card.swahili} variant="onDark" /></div>
            <div className="big">{card.swahili}</div>
            <div className="tiny">Tap to reveal · {card.lessonTitle}</div>
          </div>
          <div className="flashcard-face flashcard-back">
            <div className="flashcard-speak"><SpeakButton text={card.swahili} variant="onDark" /></div>
            <div className="big">{card.english}</div>
            <div className="tiny">{card.swahili}</div>
          </div>
        </div>
      </div>

      <div className="row center" style={{ gap: 12 }}>
        <button className="btn btn-ghost" onClick={() => go(-1)}>← Previous</button>
        <button className="btn btn-ghost" onClick={() => go(1)}>Next →</button>
      </div>

      <div className="card mt" style={{ textAlign: 'center' }}>
        <p className="mb"><strong>Test your memory</strong> with a quick 10-question mixed practice quiz.</p>
        <button className="btn btn-gold" onClick={startPractice}>Start practice quiz →</button>
      </div>
    </div>
  );
}
