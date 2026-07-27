// Central API client. Reads the JWT from localStorage and attaches it.
const BASE = '/api';

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

  // Review
  flashcards: () => request('/review/flashcards'),
  practice: (count = 10) => request(`/review/practice?count=${count}`),
};

export { getToken };
