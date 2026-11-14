// Swahili text-to-speech.
// 1) Tries the backend cloud-TTS endpoint (/api/tts) for native-quality audio,
//    caching each clip on the client so repeat plays are instant.
// 2) Falls back to the browser's built-in Web Speech voice when the backend
//    isn't configured (204) or the network call fails.

import { apiUrl } from '../config.js';

const clipCache = new Map(); // "<course>|<text>" -> objectURL | 'none'
let currentAudio = null;
let voicesPromise = null;

// The learner's course direction decides which language is spoken. Set once from
// AuthContext so components can keep calling speakSwahili(text) without threading
// the course through every prop chain.
let course = { id: 'sw', ttsLocale: 'sw-KE' };

export function setSpeechCourse(c) {
  if (!c) return;
  course = { id: c.id || 'sw', ttsLocale: c.ttsLocale || 'sw-KE' };
}

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

// Resolves when the utterance finishes (or is cancelled / errors).
function speakWithBrowser(text, rate) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve();
  return getVoices().then((voices) => new Promise((resolve) => {
    const prefix = course.ttsLocale.split('-')[0];
    const re = new RegExp(`^${prefix}\\b|^${prefix}-`, 'i');
    const match = voices.find((v) => re.test(v.lang));
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = match ? match.lang : course.ttsLocale;
    if (match) u.voice = match;
    u.rate = rate;
    u.onend = resolve;
    u.onerror = resolve;
    window.speechSynthesis.speak(u);
  }));
}

// ---- backend cloud audio (preferred) ----
async function getBackendClip(text) {
  const key = `${course.id}|${text}`;
  if (clipCache.has(key)) {
    const v = clipCache.get(key);
    return v === 'none' ? null : v;
  }
  try {
    const res = await fetch(apiUrl(`/api/tts?text=${encodeURIComponent(text)}&course=${encodeURIComponent(course.id)}`));
    if (res.status === 200) {
      const blob = await res.blob();
      if (blob.size > 0) {
        const url = URL.createObjectURL(blob);
        clipCache.set(key, url);
        return url;
      }
    }
    // 204 (not configured) or empty body — remember so we stop re-asking.
    clipCache.set(key, 'none');
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

// Like speakSwahili, but the promise resolves only once the clip has finished
// playing — used to play a whole dialogue line by line. A timeout guards
// against a voice that never reports its end.
export async function speakAndWait(text, { rate = 0.8 } = {}) {
  if (!text || typeof window === 'undefined') return;
  const guard = new Promise((resolve) => setTimeout(resolve, 4000 + text.length * 150));

  const url = await getBackendClip(text);
  if (url) {
    try {
      if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
      const audio = new Audio(url);
      currentAudio = audio;
      const ended = new Promise((resolve) => {
        audio.onended = resolve;
        audio.onpause = resolve; // stopSpeaking() or another clip took over
        audio.onerror = resolve;
      });
      await audio.play();
      await Promise.race([ended, guard]);
      return;
    } catch {
      // fall through to the built-in voice
    }
  }
  await Promise.race([speakWithBrowser(text, rate), guard]);
}

export function stopSpeaking() {
  if (typeof window === 'undefined') return;
  if (currentAudio) { try { currentAudio.pause(); } catch { /* already stopped */ } }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}
