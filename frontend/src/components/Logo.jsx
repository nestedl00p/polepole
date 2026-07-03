// PolePole tortoise logo. Uses the pre-cropped, transparent square mark at
// frontend/public/polepole-mark.png (served by Vite at /polepole-mark.png).
// `size` controls the glyph height; the wordmark is optional.
export default function Logo({ size = 34, wordmark = true, light = false }) {
  return (
    <span className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <img
        src="/polepole-mark.png"
        alt="PolePole"
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
      />
      {wordmark && (
        <span
          className="logo-word"
          style={{ fontWeight: 800, fontSize: size * 0.6, letterSpacing: '0.3px', color: light ? '#fff' : 'var(--navy)' }}
        >
          PolePole
        </span>
      )}
    </span>
  );
}
