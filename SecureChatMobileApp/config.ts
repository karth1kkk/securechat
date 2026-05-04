import Constants from 'expo-constants';

type ExpoExtra = {
  apiUrl?: string;
  graphqlUrl?: string;
  giphyApiKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

function trim(s: string | undefined): string {
  return typeof s === 'string' ? s.trim() : '';
}

/**
 * API / GraphQL base URLs.
 *
 * **Order matters:** `process.env.EXPO_PUBLIC_*` is inlined by Metro from `.env` / EAS env at bundle time.
 * `app.config.js` → `extra` is evaluated in Node and may default to localhost if env is not visible there,
 * which would wrongly override a correct Metro-inlined URL. So always prefer Metro env first, then `extra`.
 */
const API_URL = (
  trim(process.env.EXPO_PUBLIC_API_URL) ||
  trim(process.env.API_URL) ||
  trim(extra.apiUrl) ||
  'http://localhost:5002'
).replace(/\/$/, '');

const GRAPHQL_URL = (
  trim(process.env.EXPO_PUBLIC_GRAPHQL_URL) ||
  trim(process.env.GRAPHQL_URL) ||
  trim(extra.graphqlUrl) ||
  `${API_URL}/graphql`
).replace(/\/graphql\/?$/, '/graphql');

const SIGNALR_URL = `${API_URL}/hubs/messaging`;
const CALL_HUB_URL = `${API_URL}/hubs/call`;

/** Giphy search (GIF picker). Prefer Metro `.env`, then `app.config.js` → `extra.giphyApiKey` (EAS). */
const GIPHY_API_KEY = trim(process.env.EXPO_PUBLIC_GIPHY_API_KEY) || trim(extra.giphyApiKey);

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('[SecureChat] API_URL=', API_URL, '| GRAPHQL_URL=', GRAPHQL_URL, '| CALL_HUB_URL=', CALL_HUB_URL);
  if (/localhost|127\.0\.0\.1/i.test(API_URL)) {
    console.warn(
      '[SecureChat] API_URL is localhost. Set EXPO_PUBLIC_API_URL / EXPO_PUBLIC_GRAPHQL_URL in .env to your HTTPS API, restart Metro with -c, rebuild release builds.'
    );
  }
}

/** Comma-separated ICE server URLs (each becomes one `urls` entry). */
function parseIceUrlList(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * WebRTC ICE: public STUN by default (multiple for reliability). Different networks / cellular often need TURN.
 * Set `EXPO_PUBLIC_ICE_TURN_URLS` + username + credential (e.g. Metered, Twilio, or your own coturn).
 */
export function buildRtcConfiguration(): RTCConfiguration {
  const stunList = parseIceUrlList(process.env.EXPO_PUBLIC_ICE_STUN_URLS);
  const defaultStun: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];
  const iceServers: RTCIceServer[] =
    stunList.length > 0 ? stunList.map((urls) => ({ urls })) : defaultStun;

  const turnUrls = parseIceUrlList(process.env.EXPO_PUBLIC_ICE_TURN_URLS);
  const turnUser = process.env.EXPO_PUBLIC_ICE_TURN_USERNAME?.trim();
  const turnCred = process.env.EXPO_PUBLIC_ICE_TURN_CREDENTIAL?.trim();

  if (turnUrls.length > 0 && turnUser && turnCred) {
    for (const urls of turnUrls) {
      iceServers.push({
        urls,
        username: turnUser,
        credential: turnCred
      });
    }
  }

  return { iceServers };
}

export { GRAPHQL_URL, API_URL, SIGNALR_URL, CALL_HUB_URL, GIPHY_API_KEY };
