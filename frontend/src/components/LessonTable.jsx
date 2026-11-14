import { useState } from 'react';
import SpeakButton from './SpeakButton';
import { speakSwahili } from '../lib/speak';
import { useAuth } from '../context/AuthContext';
import { lessonStrings, tableLanguageColumns, speakable } from '../lib/lessonStrings';

// Lesson table. Columns written in the language being learned get a 🔊 on
// every cell, and tables with a recall pair (word ↔ meaning, present ↔ past…)
// get a self-test mode: hide either column, recall it, tap to check.
// Which columns qualify is decided from the headers in lib/lessonStrings.js.
export default function LessonTable({ block }) {
  const { user } = useAuth();
  const t = lessonStrings(user?.course);
  const headers = block.tableHeaders || [];
  const rows = block.tableRows || [];
  const { targetCol, knownCol, speakCols } = tableLanguageColumns(headers, user?.course);
  const canTest = targetCol >= 0 && knownCol >= 0;

  const [hiddenCol, setHiddenCol] = useState(-1);
  const [revealed, setRevealed] = useState(() => new Set());

  const setMode = (col) => { setHiddenCol(col); setRevealed(new Set()); };
  const reveal = (ri, cell) => {
    setRevealed((s) => new Set(s).add(ri));
    if (speakCols.has(hiddenCol)) speakSwahili(speakable(cell));
  };

  return (
    <div className="block">
      {canTest && (
        <div className="lt-bar" role="group">
          <button type="button" className={`lt-mode ${hiddenCol === -1 ? 'active' : ''}`} onClick={() => setMode(-1)}>{t.showAll}</button>
          <button type="button" className={`lt-mode ${hiddenCol === knownCol ? 'active' : ''}`} onClick={() => setMode(knownCol)}>{t.hide(headers[knownCol])}</button>
          <button type="button" className={`lt-mode ${hiddenCol === targetCol ? 'active' : ''}`} onClick={() => setMode(targetCol)}>{t.hide(headers[targetCol])}</button>
        </div>
      )}
      <div className="table-wrap">
        <table className="swtable">
          <thead>
            <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((c, ci) => {
                  if (ci === hiddenCol && !revealed.has(ri)) {
                    return (
                      <td key={ci}>
                        <button type="button" className="lt-cover" onClick={() => reveal(ri, c)}>{t.tapToReveal}</button>
                      </td>
                    );
                  }
                  if (speakCols.has(ci)) {
                    return (
                      <td key={ci}>
                        <span className="lt-cell">
                          <span>{c}</span>
                          <SpeakButton text={speakable(c)} size="sm" />
                        </span>
                      </td>
                    );
                  }
                  return <td key={ci}>{c}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hiddenCol !== -1 && <p className="lt-hint">{t.tableHint}</p>}
    </div>
  );
}
