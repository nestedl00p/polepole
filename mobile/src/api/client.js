// Central API client. Reads the JWT from AsyncStorage and attaches it.
// Mirrors the web frontend's client, adapted for React Native (async storage,
// absolute base URL instead of a Vite dev proxy).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'swahili_token';
const BASE = `${API_BASE_URL}/api`;

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    const err = new Error(
      `Can't reach the server at ${API_BASE_URL}. Is the backend running, and is the host correct for your device? (See src/config.js)`
    );
    err.status = 0;
    err.cause = networkErr;
    throw err;
  }

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
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
  // Auth
  // Courses (learning directions) — public, used by the sign-up picker
  listCourses: () => request('/courses', { auth: false }),

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
