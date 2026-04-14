/**
 * Expo prefers this over app.json when present. Merges app.json and optionally embeds API URLs in `extra`.
 *
 * `extra` is only set when `EXPO_PUBLIC_*` / `API_URL` are explicitly set in the environment when this
 * file runs. We do **not** default `extra.apiUrl` to localhost — that can override Metro-inlined
 * `EXPO_PUBLIC_API_URL` from `.env` in `config.ts` and break hosted SignalR/WebRTC.
 *
 * For production: set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_GRAPHQL_URL in EAS / CI before building.
 */
const fs = require('fs');
const path = require('path');

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));

const trim = (s) => (typeof s === 'string' ? s.trim() : '');

const explicitApi = trim(process.env.EXPO_PUBLIC_API_URL) || trim(process.env.API_URL);
const normalizedApi = explicitApi ? explicitApi.replace(/\/$/, '') : undefined;

const explicitGraphql = trim(process.env.EXPO_PUBLIC_GRAPHQL_URL) || trim(process.env.GRAPHQL_URL);
const normalizedGraphql = explicitGraphql
  ? explicitGraphql.replace(/\/graphql\/?$/i, '/graphql')
  : undefined;

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      ...(normalizedApi && { apiUrl: normalizedApi }),
      ...(normalizedGraphql && { graphqlUrl: normalizedGraphql })
    }
  }
};
