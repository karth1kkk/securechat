// EXPO_PUBLIC_* is inlined at build time (required for static web deploys, e.g. Vercel).
const GRAPHQL_URL = (
  process.env.EXPO_PUBLIC_GRAPHQL_URL?.trim() ||
  process.env.GRAPHQL_URL?.trim() ||
  'http://localhost:5002/graphql'
).replace(/\/graphql\/?$/, '/graphql');
const API_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  process.env.API_URL?.trim() ||
  'http://localhost:5002'
).replace(/\/$/, '');
const SIGNALR_URL = `${API_URL}/hubs/messaging`;
const CALL_HUB_URL = `${API_URL}/hubs/call`;

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
 * WebRTC ICE: public STUN by default. For symmetric NAT / corporate firewalls, set
 * `EXPO_PUBLIC_ICE_TURN_URLS` plus username and credential (short-lived creds from your TURN provider are ideal).
 */
export function buildRtcConfiguration(): RTCConfiguration {
  const stunList = parseIceUrlList(process.env.EXPO_PUBLIC_ICE_STUN_URLS);
  const iceServers: RTCIceServer[] =
    stunList.length > 0 ? stunList.map((urls) => ({ urls })) : [{ urls: 'stun:stun.l.google.com:19302' }];

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

export { GRAPHQL_URL, API_URL, SIGNALR_URL, CALL_HUB_URL };
