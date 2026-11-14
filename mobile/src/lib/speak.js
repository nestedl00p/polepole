// Swahili text-to-speech for mobile.
// 1) Tries the backend cloud-TTS endpoint (/api/tts) for native-quality audio,
//    played as a remote MP3 via expo-audio.
// 2) Falls back to the device's built-in voice (expo-speech) when cloud TTS
//    isn't configured or playback fails.
import * as Speech from 'expo-speech';
import { createAudioPlayer } from 'expo-audio';
import { API_BASE_URL } from '../config';

let enabledPromise = null;
let player = null;

// The learner's course direction decides which language is spoken. Set once from
// AuthContext so components can keep calling speakSwahili(text) unchanged.
let course = { id: 'sw', ttsLocale: 'sw-KE' };

export function setSpeechCourse(c) {
  if (!c) return;
  course = { id: c.id || 'sw', ttsLocale: c.ttsLocale || 'sw-KE' };
}

// Check once whether the backend has cloud TTS configured.
function backendEnabled() {
  if (!enabledPromise) {
    enabledPromise = fetch(`${API_BASE_URL}/api/tts/status`)
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((j) => !!j.enabled)
      .catch(() => false);
  }
  return enabledPromise;
}

export const isSpeechSupported = () => true;

function speakWithDevice(text, rate) {
  Speech.stop();
  Speech.speak(text, { language: course.ttsLocale.split('-')[0], rate });
}

export async function speakSwahili(text, { rate = 0.85 } = {}) {
  if (!text) return;

  try {
    if (await backendEnabled()) {
      if (player) { try { player.remove(); } catch {} player = null; }
      player = createAudioPlayer({
        uri: `${API_BASE_URL}/api/tts?text=${encodeURIComponent(text)}&course=${encodeURIComponent(course.id)}`,
      });
      player.play();
      return; // cloud audio is already slowed server-side
    }
  } catch {
    // fall through to the device voice
  }

  speakWithDevice(text, rate);
}

// Like speakSwahili, but resolves only once the clip has finished playing —
// used to play a whole dialogue line by line. A timeout guards against a
// player or voice that never reports its end.
export async function speakAndWait(text, { rate = 0.85 } = {}) {
  if (!text) return;
  const guard = new Promise((resolve) => setTimeout(resolve, 4000 + text.length * 150));

  try {
    if (await backendEnabled()) {
      if (player) { try { player.remove(); } catch {} player = null; }
      const p = createAudioPlayer({
        uri: `${API_BASE_URL}/api/tts?text=${encodeURIComponent(text)}&course=${encodeURIComponent(course.id)}`,
      });
      player = p;
      const ended = new Promise((resolve) => {
        waiting = resolve; // stopSpeaking() releases the wait
        p.addListener('playbackStatusUpdate', (s) => { if (s.didJustFinish) resolve(); });
      });
      p.play();
      await Promise.race([ended, guard]);
      return;
    }
  } catch {
    // fall through to the device voice
  }

  const spoken = new Promise((resolve) => {
    Speech.stop();
    Speech.speak(text, {
      language: course.ttsLocale.split('-')[0],
      rate,
      onDone: resolve,
      onStopped: resolve,
      onError: resolve,
    });
  });
  await Promise.race([spoken, guard]);
}

let waiting = null;

export function stopSpeaking() {
  if (player) { try { player.remove(); } catch {} player = null; }
  Speech.stop();
  if (waiting) { waiting(); waiting = null; }
}
