import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import { SUBSCRIPTIONS_ENABLED } from '../config';
import { LANDING_STRINGS, LANDING_LOCALES, initialLandingLocale, saveLandingLocale } from '../lib/landingStrings';

// Icons and numbers are the same in every language; the words come from
// landingStrings, matched up by position.
const FEATURE_ICONS = ['🧭', '🐢', '🃏', '✅', '🔥', '💬'];
const STAT_NUMBERS = ['31', '4', '300+', '0→💬'];

export default function LandingPage() {
  const { user } = useAuth();
  const [locale, setLocale] = useState(initialLandingLocale);
  const t = LANDING_STRINGS[locale];

  // Tell browsers and screen readers which language the page is in, and hand
  // the document back as English (the rest of the site) on the way out.
  useEffect(() => {
    document.documentElement.lang = locale;
    return () => { document.documentElement.lang = 'en'; };
  }, [locale]);

  const chooseLocale = (code) => { setLocale(code); saveLandingLocale(code); };
  const faqs = t.faqs.filter((f) => SUBSCRIPTIONS_ENABLED || !f.pricing);

  // In the header on wide screens; a phone's header has no room for it, so
  // there it is the copy in the footer that shows.
  const localePicker = (
    <select
      className="lp-locale"
      aria-label={t.language}
      value={locale}
      onChange={(e) => chooseLocale(e.target.value)}
    >
      {LANDING_LOCALES.map((l) => (
        <option key={l.code} value={l.code} lang={l.code}>{l.label}</option>
      ))}
    </select>
  );

  const primaryCta = user
    ? { to: '/app', label: t.goToDashboard }
    // Straight into three words of Swahili, not into a sign-up form: the
    // account is offered afterwards, as a way to keep what they just did.
    : { to: '/try', label: t.tryNow };

  return (
    <div className="lp">
      {/* ---------- Header ---------- */}
      <header className="lp-header">
        <div className="container lp-header-inner">
          <Link to="/" className="lp-brand"><Logo size={34} /></Link>
          <nav className="lp-nav">
            <a href="#features">{t.nav.course}</a>
            <a href="#curriculum">{t.nav.curriculum}</a>
            <a href="#how">{t.nav.how}</a>
            {SUBSCRIPTIONS_ENABLED && <a href="#pricing">{t.nav.pricing}</a>}
          </nav>
          <div className="lp-header-cta">
            {localePicker}
            {user ? (
              <Link to="/app" className="btn btn-primary btn-sm">{t.myDashboard}</Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">{t.login}</Link>
                <Link to="/try" className="btn btn-gold btn-sm">{t.getStarted}</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="lp-hero">
        <div className="container lp-hero-inner">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">{t.eyebrow}</span>
            <h1>{t.heroTitle}<br /><span className="accent" lang="sw">pole pole.</span></h1>
            <p className="lp-lead">
              {t.heroLead[0]}<em lang="sw">Pole pole ndiyo mwendo</em>{t.heroLead[1]}
            </p>
            <div className="lp-hero-actions">
              <Link to={primaryCta.to} className="btn btn-gold">{primaryCta.label}</Link>
              <a href="#curriculum" className="btn btn-ghost">{t.seeCurriculum}</a>
            </div>
            <p className="lp-trust">{t.trust}</p>
          </div>
          <div className="lp-hero-art">
            <div className="lp-hero-badge"><Logo size={150} wordmark={false} /></div>
          </div>
        </div>
      </section>

      {/* ---------- Stats ---------- */}
      <section className="lp-stats">
        <div className="container lp-stats-inner">
          {STAT_NUMBERS.map((n, i) => (
            <div className="lp-stat" key={n}><span className="n">{n}</span><span className="l">{t.stats[i]}</span></div>
          ))}
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="lp-section" id="features">
        <div className="container">
          <div className="lp-section-head">
            <h2>{t.featuresTitle}</h2>
            <p>{t.featuresLead}</p>
          </div>
          <div className="lp-grid">
            {t.features.map((f, i) => (
              <div className="lp-feature" key={f.title}>
                <div className="lp-feature-icon">{FEATURE_ICONS[i]}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="lp-section lp-section-alt" id="how">
        <div className="container">
          <div className="lp-section-head">
            <h2>{t.howTitle}</h2>
            <p>{t.howLead}</p>
          </div>
          <div className="lp-steps">
            {t.steps.map((s, i) => (
              <div className="lp-step" key={s.title}>
                <div className="lp-step-num">{i + 1}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Curriculum ---------- */}
      <section className="lp-section" id="curriculum">
        <div className="container">
          <div className="lp-section-head">
            <h2>{t.curriculumTitle}</h2>
            <p>{t.curriculumLead}</p>
          </div>
          <div className="lp-weeks">
            {t.weeks.map((w, i) => (
              <div className="lp-week" key={w.title}>
                <div className="lp-week-tag">{t.week(i + 1)}</div>
                <h3>{w.title}</h3>
                <p>{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Pricing (hidden until subscriptions are enabled) ---------- */}
      {SUBSCRIPTIONS_ENABLED && (
      <section className="lp-section lp-section-alt" id="pricing">
        <div className="container lp-pricing">
          <div className="lp-section-head">
            <h2>{t.pricingTitle}</h2>
            <p>{t.pricingLead}</p>
          </div>
          <div className="lp-price-card">
            <div className="lp-price-tag">{t.priceTag}</div>
            <div className="lp-price-amount">$0<span>{t.pricePeriod}</span></div>
            <ul className="lp-price-list">
              {t.priceList.map((item) => <li key={item}>✓ {item}</li>)}
            </ul>
            <Link to={primaryCta.to} className="btn btn-gold btn-block">{primaryCta.label}</Link>
          </div>
        </div>
      </section>
      )}

      {/* ---------- FAQ ---------- */}
      {/* Takes over the alternate background when Pricing is hidden, so two
          plain sections don't sit back to back. */}
      <section className={`lp-section${SUBSCRIPTIONS_ENABLED ? '' : ' lp-section-alt'}`} id="faq">
        <div className="container lp-faq">
          <div className="lp-section-head">
            <h2>{t.faqTitle}</h2>
          </div>
          {faqs.map((f) => (
            <div className="lp-faq-item" key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="lp-cta">
        <div className="container lp-cta-inner">
          <h2>{t.ctaTitle}</h2>
          <p>{t.ctaBody}</p>
          <Link to={primaryCta.to} className="btn btn-gold">{primaryCta.label}</Link>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="lp-footer">
        <div className="container lp-footer-inner">
          <div className="lp-footer-brand">
            <Logo size={30} light />
            <p>{t.footerTagline}</p>
          </div>
          <div className="lp-footer-links">
            <a href="#features">{t.nav.course}</a>
            <a href="#curriculum">{t.nav.curriculum}</a>
            {SUBSCRIPTIONS_ENABLED && <a href="#pricing">{t.nav.pricing}</a>}
            <Link to="/login">{t.login}</Link>
            {localePicker}
          </div>
        </div>
        <div className="lp-footer-bottom">
          <div className="container">© {new Date().getFullYear()} PolePole · polepole.com · {t.footerMade}</div>
        </div>
      </footer>
    </div>
  );
}
