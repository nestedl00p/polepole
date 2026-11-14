// Central API client. Reads the JWT from localStorage and attaches it.
import { apiUrl } from '../config.js';

const BASE = apiUrl('/api');

function getToken() {
  return localStorage.getItem('swahili_token');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const message = (data && data.message) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

// multipart/form-data: the browser sets the Content-Type (with its boundary),
// so this cannot go through request(), which always sends JSON.
async function upload(path, form) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && data.message) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Courses (learning directions) — public, used by the sign-up picker
  listCourses: () => request('/courses', { auth: false }),

  // Auth
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),

  // User
  me: () => request('/user/me'),
  updatePace: (planLengthDays) => request('/user/pace', { method: 'PUT', body: { planLengthDays } }),
  restart: () => request('/user/restart', { method: 'POST' }),

  // Lessons
  listLessons: () => request('/lessons'),
  getLesson: (id) => request(`/lessons/${id}`),

  // Quiz
  submitQuiz: (lessonId, answers) => request('/quiz/submit', { method: 'POST', body: { lessonId, answers } }),

  // Dose ya leo — the daily practice loop. The dose is stable within the
  // calendar day, so refetching returns the same items until they are answered.
  dose: () => request('/dose'),
  answerDose: (payload) => request('/dose/answer', { method: 'POST', body: payload }),

  completeDose: () => request('/dose/complete', { method: 'POST' }),
  updateTimeZone: (timeZoneId) => request('/user/timezone', { method: 'PUT', body: { timeZoneId } }),

  // The Dose screen was opened — distinct from fetching the dose, which the
  // dashboard also does. The server uses it to tell a prompted open from an
  // unprompted one.
  openDose: () => request('/dose/open', { method: 'POST' }),

  // The pre-signup taster: three items and a proverb, no account.
  taster: (course) => request(`/dose/taster?course=${encodeURIComponent(course)}`, { auth: false }),
  answerTaster: (payload) => request('/dose/taster/answer', { method: 'POST', body: payload, auth: false }),

  // Reminders, the why, and the day-30 question. Any field left out of
  // updateReminders is left as it is.
  updateReminders: (payload) => request('/user/reminders', { method: 'PUT', body: payload }),
  reminderShown: () => request('/user/reminders/shown', { method: 'POST' }),
  updateWhy: (why) => request('/user/why', { method: 'PUT', body: { why } }),
  habitAnswer: (answer) => request('/user/habit-answer', { method: 'POST', body: { answer } }),

  // "Nitakumbuka hii" — pin a card so future doses favour it.
  pinCard: (itemKey, pinned) => request('/cards/pin', { method: 'POST', body: { itemKey, pinned } }),

  // Kept pronunciation takes. Audio is fetched with the token and played from
  // a blob, because an <audio src> cannot send an Authorization header.
  voiceTakes: (itemKey) => request(`/voice?itemKey=${encodeURIComponent(itemKey)}`),
  keepVoiceTake: (blob, itemKey, score) => {
    const form = new FormData();
    const ext = (blob.type || '').includes('ogg') ? 'ogg' : 'webm';
    form.append('file', blob, `take.${ext}`);
    form.append('itemKey', itemKey);
    form.append('score', String(Math.round(score)));
    return upload('/voice', form);
  },
  voiceAudio: async (id) => {
    const res = await fetch(`${BASE}/voice/${id}/audio`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error(`Could not load that recording (${res.status})`);
    return res.blob();
  },

  // Review
  flashcards: () => request('/review/flashcards'),
  practice: (count = 10) => request(`/review/practice?count=${count}`),

  // The backoffice (/admin). Every one of these is refused server-side for an
  // account that is not an admin, whatever the UI shows.
  admin: {
    overview: () => request('/admin/overview'),
    users: (params) => request(`/admin/users?${query(params)}`),
    user: (id) => request(`/admin/users/${id}`),
    updateUser: (id, payload) => request(`/admin/users/${id}`, { method: 'PUT', body: payload }),
    setRole: (id, isAdmin) => request(`/admin/users/${id}/role`, { method: 'POST', body: { isAdmin } }),
    setStatus: (id, disabled) => request(`/admin/users/${id}/status`, { method: 'POST', body: { disabled } }),
    setPassword: (id, newPassword) => request(`/admin/users/${id}/password`, { method: 'POST', body: { newPassword } }),
    resetProgress: (id) => request(`/admin/users/${id}/reset-progress`, { method: 'POST' }),
    deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
    // Fetched with the token and saved from a blob: a plain link could not
    // send the Authorization header.
    exportUser: async (id) => {
      const res = await fetch(`${BASE}/admin/users/${id}/export`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`Could not export that account (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `polepole-account-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    content: () => request('/admin/content'),
    habit: () => request('/admin/habit'),
    system: () => request('/admin/system'),
    pingSpeech: () => request('/admin/system/speech/ping', { method: 'POST' }),
    clearTtsCache: () => request('/admin/system/tts-cache/clear', { method: 'POST' }),
    audit: (page = 1) => request(`/admin/audit?page=${page}`),
  },
};

// Query string from an object, leaving out anything empty.
function query(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  });
  return q.toString();
}

export { getToken };
