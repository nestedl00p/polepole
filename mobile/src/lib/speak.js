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
  Speech.speak(text, { language: 'sw', rate });
}

export async function speakSwahili(text, { rate = 0.85 } = {}) {
  if (!text) return;

  try {
    if (await backendEnabled()) {
      if (player) { try { player.remove(); } catch {} player = null; }
      player = createAudioPlayer({ uri: `${API_BASE_URL}/api/tts?text=${encodeURIComponent(text)}` });
      player.play();
      return; // cloud audio is already slowed server-side
    }
  } catch {
    // fall through to the device voice
  }

  speakWithDevice(text, rate);
}
