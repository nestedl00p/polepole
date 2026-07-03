// Swahili text-to-speech.
// 1) Tries the backend cloud-TTS endpoint (/api/tts) for native-quality audio,
//    caching each clip on the client so repeat plays are instant.
// 2) Falls back to the browser's built-in Web Speech voice when the backend
//    isn't configured (204) or the network call fails.

const clipCache = new Map(); // text -> objectURL | 'none'
let currentAudio = null;
let voicesPromise = null;

// ---- built-in Web Speech (fallback) ----
function getVoices() {
  if (!voicesPromise) {
    voicesPromise = new Promise((resolve) => {
      const ready = window.speechSynthesis.getVoices();
      if (ready && ready.length) return resolve(ready);
      window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
      setTimeout(() => resolve(window.speechSynthesis.getVoices() || []), 1000);
    });
  }
  return voicesPromise;
}

function speakWithBrowser(text, rate) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  getVoices().then((voices) => {
    const swVoice = voices.find((v) => /^sw\b|^sw-/i.test(v.lang));
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = swVoice ? swVoice.lang : 'sw-KE';
    if (swVoice) u.voice = swVoice;
    u.rate = rate;
    window.speechSynthesis.speak(u);
  });
}

// ---- backend cloud audio (preferred) ----
async function getBackendClip(text) {
  if (clipCache.has(text)) {
    const v = clipCache.get(text);
    return v === 'none' ? null : v;
  }
  try {
    const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}`);
    if (res.status === 200) {
      const blob = await res.blob();
      if (blob.size > 0) {
        const url = URL.createObjectURL(blob);
        clipCache.set(text, url);
        return url;
      }
    }
    // 204 (not configured) or empty body — remember so we stop re-asking.
    clipCache.set(text, 'none');
    return null;
  } catch {
    return null; // transient network error — don't cache, allow retry
  }
}

// True in any browser (we always have at least the Web Speech / Audio fallback).
export function isSpeechSupported() {
  return typeof window !== 'undefined' && ('speechSynthesis' in window || typeof Audio !== 'undefined');
}

export async function speakSwahili(text, { rate = 0.8 } = {}) {
  if (!text || typeof window === 'undefined') return;

  const url = await getBackendClip(text);
  if (url) {
    try {
      if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
      currentAudio = new Audio(url);
      await currentAudio.play();
      return; // cloud audio is already slowed server-side
    } catch {
      // autoplay/rejection — fall through to the built-in voice
    }
  }
  speakWithBrowser(text, rate);
}
