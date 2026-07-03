import { speakSwahili } from '../lib/speak';

// Reusable 🔊 button that pronounces a Swahili word/phrase.
// variant: 'light' (teal on white surfaces) | 'onDark' (translucent, for coloured cards)
// size: 'sm' | 'md'
export default function SpeakButton({ text, variant = 'light', size = 'md', className = '' }) {
  if (!text) return null;
  return (
    <button
      type="button"
      className={`speak-btn speak-btn-${variant} speak-btn-${size} ${className}`.trim()}
      onClick={(e) => { e.stopPropagation(); speakSwahili(text); }}
      title="Hear it"
      aria-label={`Hear ${text} spoken`}
    >
      🔊
    </button>
  );
}
