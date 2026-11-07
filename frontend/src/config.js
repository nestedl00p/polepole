// Where the API lives.
//
// Empty (the default) means "same origin" — the single-container deploy, where
// the .NET API also serves this frontend out of its wwwroot, so a plain /api/...
// path just works and there is no CORS.
//
// Set VITE_API_BASE at build time when the frontend is hosted separately from
// the API (e.g. the static site on Vercel, the API on Azure App Service):
//   VITE_API_BASE=https://polepole-app-1234.azurewebsites.net
// The API must also list this site's origin in Cors:AllowedOrigins.
const configured = (import.meta.env.VITE_API_BASE ?? '').trim();

// Stored without a trailing slash so apiUrl('/api/...') never doubles it.
export const API_BASE = configured.replace(/\/+$/, '');

// Absolute URL for an API path. Pass a leading-slash path, e.g. apiUrl('/api/tts').
export function apiUrl(path) {
  return `${API_BASE}${path}`;
}
