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

export { GRAPHQL_URL, API_URL, SIGNALR_URL, CALL_HUB_URL };
