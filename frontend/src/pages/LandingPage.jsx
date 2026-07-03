import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

const FEATURES = [
  { icon: '🧭', title: 'A guided 0-to-conversational path', body: 'A structured curriculum that takes you from your first “Jambo” to holding real conversations — no guessing what to study next.' },
  { icon: '🐢', title: 'Pole pole — at your own pace', body: 'Pick a 30, 60 or 90-day plan. Lessons unlock on schedule so you build a steady habit instead of burning out.' },
  { icon: '🃏', title: 'Flashcards & spaced practice', body: 'Lock in vocabulary with flip-card drills and quick practice quizzes built from every lesson you complete.' },
  { icon: '✅', title: 'Quizzes that actually check you', body: 'Multiple-choice and free-typing questions with hints and instant feedback after each lesson.' },
  { icon: '🔥', title: 'Streaks, XP & progress', body: 'Earn XP, keep your daily streak alive, and watch your course-completion bar fill as you go.' },
  { icon: '💬', title: 'Real dialogues & culture', body: 'Learn the Swahili people actually speak — greetings, markets, travel, and the culture behind the words.' },
];

const WEEKS = [
  { n: 1, title: 'Foundations', body: 'Greetings, pronunciation, pronouns, and your very first sentences.' },
  { n: 2, title: 'Noun Classes, Numbers & Time', body: 'The famous Swahili noun classes, counting, and telling the time.' },
  { n: 3, title: 'Tenses & Daily Life', body: 'Past, present and future tenses through everyday situations.' },
  { n: 4, title: 'Complex Sentences & Culture', body: 'Connectors, fuller conversations, and cultural context to sound natural.' },
];

const STEPS = [
  { n: '1', title: 'Create your free account', body: 'Sign up and choose the pace that fits your life.' },
  { n: '2', title: 'Learn a lesson a day', body: 'Read, listen, and absorb bite-sized lessons that unlock on schedule.' },
  { n: '3', title: 'Practice & prove it', body: 'Drill flashcards and pass the quiz to unlock the next lesson.' },
];

const FAQS = [
  { q: 'Do I need any prior Swahili?', a: 'None at all. PolePole starts from absolute zero — your first lesson is greetings and pronunciation.' },
  { q: 'How long does the course take?', a: 'That’s up to you. Choose a 30-day intensive sprint or a relaxed 90-day plan — you can change your pace anytime.' },
  { q: 'How much does it cost?', a: 'PolePole is free while in beta. Create an account and start the full course today.' },
  { q: 'Is there a mobile app?', a: 'Yes — PolePole also runs as a mobile app, so you can keep learning on your phone wherever you are.' },
];

export default function LandingPage() {
  const { user } = useAuth();
  const primaryCta = user
    ? { to: '/app', label: 'Go to my dashboard' }
    : { to: '/login', label: 'Start learning free' };

  return (
    <div className="lp">
      {/* ---------- Header ---------- */}
      <header className="lp-header">
        <div className="container lp-header-inner">
          <Link to="/" className="lp-brand"><Logo size={34} /></Link>
          <nav className="lp-nav">
            <a href="#features">Course</a>
            <a href="#curriculum">Curriculum</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="lp-header-cta">
            {user ? (
              <Link to="/app" className="btn btn-primary btn-sm">My dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
                <Link to="/login" className="btn btn-gold btn-sm">Start free</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="lp-hero">
        <div className="container lp-hero-inner">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">🐢 Learn Swahili, the steady way</span>
            <h1>Learn Swahili,<br /><span className="accent">pole pole.</span></h1>
            <p className="lp-lead">
              A complete, guided Swahili course that takes you from your first greeting to real
              conversations — one bite-sized lesson at a time. <em>Pole pole ndiyo mwendo</em>:
              slowly but surely is the way.
            </p>
            <div className="lp-hero-actions">
              <Link to={primaryCta.to} className="btn btn-gold">{primaryCta.label}</Link>
              <a href="#curriculum" className="btn btn-ghost">See the curriculum</a>
            </div>
            <p className="lp-trust">Free while in beta · No credit card · Learn on web &amp; mobile</p>
          </div>
          <div className="lp-hero-art">
            <div className="lp-hero-badge"><Logo size={150} wordmark={false} /></div>
          </div>
        </div>
      </section>

      {/* ---------- Stats ---------- */}
      <section className="lp-stats">
        <div className="container lp-stats-inner">
          <div className="lp-stat"><span className="n">28</span><span className="l">Guided lessons</span></div>
          <div className="lp-stat"><span className="n">4</span><span className="l">Weekly themes</span></div>
          <div className="lp-stat"><span className="n">300+</span><span className="l">Words &amp; phrases</span></div>
          <div className="lp-stat"><span className="n">0→💬</span><span className="l">Beginner to talking</span></div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="lp-section" id="features">
        <div className="container">
          <div className="lp-section-head">
            <h2>Everything you need to actually learn</h2>
            <p>Not just word lists — a full system designed to build a real habit and real fluency.</p>
          </div>
          <div className="lp-grid">
            {FEATURES.map((f) => (
              <div className="lp-feature" key={f.title}>
                <div className="lp-feature-icon">{f.icon}</div>
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
            <h2>How PolePole works</h2>
            <p>Three simple steps. Show up a little each day, and it adds up fast.</p>
          </div>
          <div className="lp-steps">
            {STEPS.map((s) => (
              <div className="lp-step" key={s.n}>
                <div className="lp-step-num">{s.n}</div>
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
            <h2>A curriculum with a clear path</h2>
            <p>Four themed weeks that build on each other — from foundations to fluent-sounding conversation.</p>
          </div>
          <div className="lp-weeks">
            {WEEKS.map((w) => (
              <div className="lp-week" key={w.n}>
                <div className="lp-week-tag">Week {w.n}</div>
                <h3>{w.title}</h3>
                <p>{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <section className="lp-section lp-section-alt" id="pricing">
        <div className="container lp-pricing">
          <div className="lp-section-head">
            <h2>Simple pricing</h2>
            <p>The whole course, free while PolePole is in beta.</p>
          </div>
          <div className="lp-price-card">
            <div className="lp-price-tag">Free</div>
            <div className="lp-price-amount">$0<span>/ during beta</span></div>
            <ul className="lp-price-list">
              <li>✓ Full 28-lesson Swahili course</li>
              <li>✓ Flashcards &amp; practice quizzes</li>
              <li>✓ Streaks, XP &amp; progress tracking</li>
              <li>✓ Web &amp; mobile access</li>
              <li>✓ Learn at your own pace</li>
            </ul>
            <Link to={primaryCta.to} className="btn btn-gold btn-block">{primaryCta.label}</Link>
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="lp-section" id="faq">
        <div className="container lp-faq">
          <div className="lp-section-head">
            <h2>Questions, answered</h2>
          </div>
          {FAQS.map((f) => (
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
          <h2>Anza leo — start today.</h2>
          <p>Your first Swahili conversation is closer than you think. Pole pole, hatua kwa hatua.</p>
          <Link to={primaryCta.to} className="btn btn-gold">{primaryCta.label}</Link>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="lp-footer">
        <div className="container lp-footer-inner">
          <div className="lp-footer-brand">
            <Logo size={30} light />
            <p>Learn Swahili, pole pole. The steady, guided way to go from zero to conversational.</p>
          </div>
          <div className="lp-footer-links">
            <a href="#features">Course</a>
            <a href="#curriculum">Curriculum</a>
            <a href="#pricing">Pricing</a>
            <Link to="/login">Log in</Link>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <div className="container">© {new Date().getFullYear()} PolePole · polepole.com · Made with 🐢 and pole pole patience.</div>
        </div>
      </footer>
    </div>
  );
}
