// Pronunciation / speak-and-check API. Talks to the backend, which forwards the
// audio to the self-hosted Whisper sidecar and scores it against the target phrase.

let statusCache = null; // null = not yet checked
let courseId = 'sw';

// Set from AuthContext so recordings are transcribed in the language being learned.
export function setAssessCourse(id) {
  if (id) courseId = id;
}

// True only when the backend's Whisper sidecar is enabled and reachable.
export async function speechEnabled() {
  if (statusCache !== null) return statusCache;
  try {
    const res = await fetch('/api/speech/status');
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

  const res = await fetch('/api/speech/assess', { method: 'POST', body: form });
  if (res.status === 204) throw new Error('speech service unavailable');
  if (!res.ok) throw new Error(`assess failed (${res.status})`);
  return res.json();
}
