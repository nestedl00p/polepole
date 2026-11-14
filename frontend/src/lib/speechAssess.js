// Pronunciation / speak-and-check API. Talks to the backend, which forwards the
// audio to the self-hosted Whisper sidecar and scores it against the target phrase.

import { apiUrl } from '../config.js';

let statusCache = null; // null = not yet checked
let statusAt = 0;       // when it was last fetched
let courseId = 'sw';

// The status call is also what wakes a scaled-to-zero Whisper sidecar, so the
// cached answer only stands for a couple of minutes: a drill opened after a
// long pause re-asks (and re-wakes) instead of meeting a cold sidecar.
const STATUS_TTL_MS = 2 * 60 * 1000;

// Set from AuthContext so recordings are transcribed in the language being learned.
export function setAssessCourse(id) {
  if (id) courseId = id;
}

// True only when the backend's Whisper sidecar is enabled and reachable.
export async function speechEnabled() {
  if (statusCache !== null && Date.now() - statusAt < STATUS_TTL_MS) return statusCache;
  statusAt = Date.now();
  try {
    const res = await fetch(apiUrl('/api/speech/status'));
    const json = await res.json();
    statusCache = !!json.enabled;
  } catch {
    statusCache = false;
  }
  return statusCache;
}

// Sends the recorded clip + target phrase, returns the scoring result:
//   { transcription, score, completeness, confidence, wpm, words:[{word, ok}], referenceText }
// Throws on network/service failure (204 → treated as unavailable).
export async function assessPronunciation(blob, referenceText) {
  const form = new FormData();
  const ext = (blob.type || '').includes('ogg') ? 'ogg' : 'webm';
  form.append('file', blob, `take.${ext}`);
  form.append('referenceText', referenceText);
  form.append('course', courseId);

  const res = await fetch(apiUrl('/api/speech/assess'), { method: 'POST', body: form });
  if (res.status === 204) throw new Error('speech service unavailable');
  if (!res.ok) throw new Error(`assess failed (${res.status})`);
  return res.json();
}
