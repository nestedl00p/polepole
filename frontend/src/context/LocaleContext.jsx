import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { UI_STRINGS } from '../lib/uiStrings';

// The language the site itself is read in.
//
// A first-time visitor is asked once (LanguagePrompt, below) and the answer is
// kept in this browser. It decides two things: the wording of every page, and
// which courses sign-up offers — only the ones taught in that language, since
// a course's lessons are written in its teaching language.
//
// Someone already signed in who has never been asked is not interrupted: the
// site follows the language their course is taught in until they pick another
// in Settings.

// Each shown in its own language. `speaks` is the first-visit prompt's line.
export const LOCALES = [
  { code: 'en', label: 'English', speaks: 'I speak English' },
  { code: 'es', label: 'Español', speaks: 'Hablo español' },
  { code: 'sw', label: 'Kiswahili', speaks: 'Ninaongea Kiswahili' },
];

// The course a reader of each language is started on: the taster uses it, and
// sign-up falls back to it if the course list cannot be fetched.
export const COURSE_FOR_LOCALE = { en: 'sw', es: 'sw-es', sw: 'en' };

// Sign-up only offers courses taught in the reader's language.
export const courseTaughtIn = (course, locale) => course?.sourceLanguage === locale;

const STORAGE_KEY = 'polepole_locale';
const supported = (code) => (UI_STRINGS[code] ? code : null);

function savedLocale() {
  try { return supported(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

function browserLocale() {
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const code = supported((tag || '').toLowerCase().split('-')[0]);
    if (code) return code;
  }
  return null;
}

const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [chosen, setChosen] = useState(savedLocale);

  const locale = chosen ?? supported(user?.course?.sourceLanguage) ?? browserLocale() ?? 'en';

  const setLocale = useCallback((code) => {
    if (!supported(code)) return;
    setChosen(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode: lasts for this visit only */ }
  }, []);

  // The backoffice is English throughout.
  const inAdmin = pathname.startsWith('/admin');
  useEffect(() => {
    document.documentElement.lang = inAdmin ? 'en' : locale;
  }, [locale, inAdmin]);

  const value = useMemo(() => ({ locale, setLocale, t: UI_STRINGS[locale] }), [locale, setLocale]);

  // Asked once, of someone who has neither chosen nor signed in. Waits for the
  // session check so a returning learner never sees it flash past.
  const ask = !chosen && !loading && !user;

  return (
    <LocaleContext.Provider value={value}>
      {children}
      {ask && <LanguagePrompt suggested={locale} onPick={setLocale} />}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

// The picker used wherever the language can be changed afterwards.
export function LocaleSelect({ className = '' }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <select
      className={`locale-select ${className}`}
      aria-label={t.common.language}
      value={locale}
      onChange={(e) => setLocale(e.target.value)}
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code} lang={l.code}>{l.label}</option>
      ))}
    </select>
  );
}

// The first-visit question. It has no close button on purpose: the answer
// decides what the visitor is offered, so there is no sensible default to fall
// back on silently. The title is in all three languages because nobody has
// said yet which one they read.
function LanguagePrompt({ suggested, onPick }) {
  return (
    <div className="lang-prompt" role="dialog" aria-modal="true" aria-labelledby="lang-prompt-title">
      <div className="lang-prompt-card">
        <h2 id="lang-prompt-title">
          <span lang="en">Choose your language</span>
          <span lang="es">Elige tu idioma</span>
          <span lang="sw">Chagua lugha yako</span>
        </h2>
        <div className="lang-prompt-options">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              lang={l.code}
              className={`lang-prompt-opt ${l.code === suggested ? 'suggested' : ''}`}
              autoFocus={l.code === suggested}
              onClick={() => onPick(l.code)}
            >
              <strong>{l.label}</strong>
              <span>{l.speaks}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
