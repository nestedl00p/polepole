import { useEffect, useRef, useState } from 'react';
import SpeakButton from './SpeakButton';
import { speakSwahili, speakAndWait, stopSpeaking } from '../lib/speak';
import { useAuth } from '../context/AuthContext';
import { lessonStrings } from '../lib/lessonStrings';

// Dialogue block. `swahili` holds the line in the language being learned and
// `english` its translation, in both course directions.
//  - 🔊 per line, and Listen plays the whole conversation line by line
//  - translations can be hidden (tap a line to peek)
//  - pick a speaker to role-play: that speaker's lines are covered until you
//    have said them and tap to check
export default function Dialogue({ block }) {
  const { user } = useAuth();
  const t = lessonStrings(user?.course);
  const lines = block.dialogue || [];
  const speakers = [...new Set(lines.map((d) => d.speaker))];

  const [playing, setPlaying] = useState(-1);
  const [hideTr, setHideTr] = useState(false);
  const [role, setRole] = useState(null);
  const [shown, setShown] = useState(() => new Set()); // lines peeked / checked
  const run = useRef(0);

  useEffect(() => () => { run.current++; stopSpeaking(); }, []);

  const stop = () => { run.current++; stopSpeaking(); setPlaying(-1); };

  const listen = async () => {
    if (playing !== -1) return stop();
    const id = ++run.current;
    for (let i = 0; i < lines.length; i++) {
      if (run.current !== id) return;
      setPlaying(i);
      await speakAndWait(lines[i].swahili);
      if (run.current !== id) return;
      await new Promise((r) => setTimeout(r, 350));
    }
    if (run.current === id) setPlaying(-1);
  };

  const pickRole = (s) => { setRole((r) => (r === s ? null : s)); setShown(new Set()); };
  const show = (i) => setShown((s) => new Set(s).add(i));

  return (
    <div className="block dlg">
      <div className="dlg-bar">
        <button type="button" className="btn btn-primary btn-sm" onClick={listen}>{playing === -1 ? t.listen : t.stop}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setHideTr((h) => !h); setShown(new Set()); }}>
          {hideTr ? t.showTranslations : t.hideTranslations}
        </button>
        {speakers.length > 1 && (
          <span className="dlg-roles">
            <span className="dlg-roles-label">{t.playRole}</span>
            {speakers.map((s) => (
              <button type="button" key={s} className={`lt-mode ${role === s ? 'active' : ''}`} aria-pressed={role === s} onClick={() => pickRole(s)}>{s}</button>
            ))}
          </span>
        )}
      </div>

      {lines.map((d, i) => {
        const mine = role === d.speaker;
        const covered = mine && !shown.has(i);
        const trHidden = hideTr && !mine && !shown.has(i);
        return (
          <div className={`dialogue-line ${playing === i ? 'playing' : ''} ${mine ? 'mine' : ''}`} key={i}>
            <div className="dlg-top">
              <div className="dlg-text">
                <span className="sp">{d.speaker}: </span>
                {covered ? (
                  <button type="button" className="lt-cover" onClick={() => { show(i); speakSwahili(d.swahili); }}>{t.yourLine}</button>
                ) : (
                  <span className="sw">{d.swahili}</span>
                )}
              </div>
              {!covered && <SpeakButton text={d.swahili} size="sm" />}
            </div>
            {trHidden ? (
              <button type="button" className="lt-cover dlg-tr-cover" onClick={() => show(i)}>{t.tapToReveal}</button>
            ) : (
              <div className="en">{d.english}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
