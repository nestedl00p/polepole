import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import SpeakButton from '../components/SpeakButton';
import { useLocale } from '../context/LocaleContext';

// The reader: paste something written in the language being learned, tap the
// words you don't know, keep the ones worth keeping. A kept word becomes a card
// of the learner's own — in the flashcard deck, and pinned so the next dose
// asks about it.
//
// The text stays in this browser. It is split into words here, and the server
// only ever sees a tapped word and the sentence around it.

const DRAFT_KEY = 'polepole_reader_text';
const MAX_TEXT = 20000;

// A word: letters (with their combining marks), and the apostrophes and
// hyphens that sit inside one — ng'ombe, don't, well-known.
const WORD = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;
// A sentence, with whatever closes it.
const SENTENCE = /[^.!?…]+[.!?…]*["”')\]]*\s*/g;

const fold = (s) => s.toLocaleLowerCase();

// text → paragraphs → tokens. Each word token carries its sentence, which is
// what an explanation is asked about.
function tokenize(text) {
  let id = 0;
  return text.split(/\n+/).filter((p) => p.trim()).map((para) => {
    const tokens = [];
    for (const sentence of para.match(SENTENCE) || [para]) {
      const context = sentence.trim();
      let last = 0;
      for (const m of sentence.matchAll(WORD)) {
        if (m.index > last) tokens.push({ id: id++, text: sentence.slice(last, m.index) });
        tokens.push({ id: id++, text: m[0], word: true, sentence: context });
        last = m.index + m[0].length;
      }
      if (last < sentence.length) tokens.push({ id: id++, text: sentence.slice(last) });
    }
    return tokens;
  });
}

function loadDraft() {
  try { return sessionStorage.getItem(DRAFT_KEY) || ''; } catch { return ''; }
}

export default function Reader() {
  const { t: all } = useLocale();
  const t = all.reader;

  const [text, setText] = useState(loadDraft);
  const [reading, setReading] = useState(() => loadDraft().trim().length > 0);
  const [status, setStatus] = useState({ gloss: false, glossesLeft: 0 });
  const [deck, setDeck] = useState(() => new Set());   // words the course has taught
  const [words, setWords] = useState([]);              // the learner's own
  const [sel, setSel] = useState(null);                // the tapped token
  const [panel, setPanel] = useState(null);            // { loading, lemma, meaning, note, hint, saving, result }
  const request = useRef(0);

  useEffect(() => {
    api.readerStatus().then(setStatus).catch(() => {});
    api.ownWords().then((d) => setWords(d.words || [])).catch(() => {});
    api.flashcards()
      .then((d) => setDeck(new Set((d.cards || []).filter((c) => !c.own).map((c) => fold(c.target ?? c.swahili)))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, text); } catch { /* private mode: the draft just isn't kept */ }
  }, [text]);

  const paragraphs = useMemo(() => (reading ? tokenize(text) : []), [reading, text]);

  // Every form the learner has already kept: the dictionary form and the form
  // it was seen as.
  const kept = useMemo(() => {
    const s = new Set();
    words.forEach((w) => { s.add(fold(w.target)); if (w.seenAs) s.add(fold(w.seenAs)); });
    return s;
  }, [words]);

  const pick = async (token) => {
    const mine = ++request.current;
    setSel(token);

    const manual = (hint) => setPanel({ lemma: fold(token.text), meaning: '', note: '', hint });
    if (!status.gloss) return manual(t.typeMeaning);

    setPanel({ loading: true, lemma: '', meaning: '', note: '' });
    try {
      const g = await api.gloss(token.text, token.sentence);
      if (mine !== request.current) return; // another word was tapped meanwhile
      setPanel({ lemma: g.lemma, meaning: g.meaning, note: g.note });
      setStatus((s) => ({ ...s, glossesLeft: g.glossesLeft }));
    } catch (err) {
      if (mine !== request.current) return;
      manual(err.status === 429 ? t.limitReached : t.noExplanation);
    }
  };

  const close = () => { request.current++; setSel(null); setPanel(null); };

  const add = async () => {
    const target = panel.lemma.trim();
    const source = panel.meaning.trim();
    if (!target || !source) return;
    setPanel((p) => ({ ...p, saving: true, result: null }));
    try {
      const res = await api.addOwnWord({ target, source, seenAs: sel.text, context: sel.sentence, note: panel.note });
      if (res.added) {
        setWords((ws) => [res.word, ...ws.filter((w) => w.id !== res.word.id)]);
        setPanel((p) => ({ ...p, saving: false, result: t.added }));
      } else {
        // The course already teaches it: the card that exists was pinned.
        setDeck((d) => new Set(d).add(fold(sel.text)));
        setPanel((p) => ({ ...p, saving: false, result: t.alreadyTaught }));
      }
    } catch (err) {
      setPanel((p) => ({ ...p, saving: false, result: err.message || all.common.somethingWrong }));
    }
  };

  const remove = async (word) => {
    try {
      await api.removeOwnWord(word.id);
      setWords((ws) => ws.filter((w) => w.id !== word.id));
    } catch { /* still listed, so it can be tried again */ }
  };

  return (
    <div className="container page narrow">
      <div className="page-head">
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </div>

      {!reading ? (
        <div className="card">
          <textarea
            className="reader-input"
            value={text}
            maxLength={MAX_TEXT}
            placeholder={t.placeholder}
            aria-label={t.placeholder}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="row mt" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" disabled={!text.trim()} onClick={() => setReading(true)}>
              {t.read}
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="row spread reader-bar">
            <span className="muted reader-hint">{t.tapHint}</span>
            <span className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { close(); setReading(false); }}>{t.edit}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { close(); setText(''); setReading(false); }}>{t.clear}</button>
            </span>
          </div>

          <div className="reader-text">
            {paragraphs.map((tokens, i) => (
              <p key={i}>
                {tokens.map((tok) => {
                  if (!tok.word) return tok.text;
                  const f = fold(tok.text);
                  const cls = [
                    'reader-word',
                    kept.has(f) ? 'kept' : deck.has(f) ? 'known' : '',
                    sel?.id === tok.id ? 'sel' : '',
                  ].join(' ').trim();
                  return (
                    <button type="button" key={tok.id} className={cls} onClick={() => pick(tok)}>{tok.text}</button>
                  );
                })}
              </p>
            ))}
          </div>

          <div className="reader-legend muted">
            <span><i className="reader-swatch known" /> {t.legendKnown}</span>
            <span><i className="reader-swatch kept" /> {t.legendKept}</span>
          </div>
        </div>
      )}

      {sel && panel && (
        <div className="reader-panel" role="dialog" aria-label={sel.text}>
          <div className="row spread">
            <div className="reader-panel-word">
              {sel.text}
              <SpeakButton text={panel.lemma || sel.text} size="sm" />
            </div>
            <button className="reader-close" onClick={close} aria-label={t.close}>✕</button>
          </div>

          {panel.loading ? (
            <p className="muted">{t.explaining}</p>
          ) : (
            <>
              {panel.hint && <p className="muted reader-panel-hint">{panel.hint}</p>}
              <div className="reader-fields">
                <label>
                  <span>{t.lemma}</span>
                  <input
                    value={panel.lemma}
                    maxLength={60}
                    onChange={(e) => setPanel((p) => ({ ...p, lemma: e.target.value, result: null }))}
                  />
                </label>
                <label>
                  <span>{t.meaning}</span>
                  <input
                    value={panel.meaning}
                    maxLength={120}
                    autoFocus={!panel.meaning}
                    onChange={(e) => setPanel((p) => ({ ...p, meaning: e.target.value, result: null }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                  />
                </label>
              </div>
              {panel.note && <p className="reader-note">{panel.note}</p>}
              <div className="row reader-panel-actions">
                <button
                  className="btn btn-primary btn-sm"
                  disabled={panel.saving || !panel.lemma.trim() || !panel.meaning.trim()}
                  onClick={add}
                >
                  {panel.saving ? all.common.saving : t.add}
                </button>
                {panel.result && <span className="reader-result" role="status">{panel.result}</span>}
              </div>
            </>
          )}
        </div>
      )}

      <div className="card mt">
        <h2 className="reader-words-title">{t.myWords(words.length)}</h2>
        {words.length === 0 ? (
          <p className="muted">{t.noWords}</p>
        ) : (
          <ul className="reader-words">
            {words.map((w) => (
              <li key={w.id}>
                <div>
                  <strong>{w.target}</strong> <SpeakButton text={w.target} size="sm" /> — {w.source}
                  {w.context && <div className="muted reader-context">{w.context}</div>}
                </div>
                <button className="reader-close" onClick={() => remove(w)} aria-label={t.remove(w.target)} title={t.remove(w.target)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
