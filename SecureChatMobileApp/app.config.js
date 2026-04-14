/**
 * Expo prefers this over app.json when present. Merges app.json and embeds API URLs in `extra`
 * so the runtime (config.ts) and native builds see the same values as EXPO_PUBLIC_* at build time.
 *
 * For production / hosted: set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_GRAPHQL_URL in EAS, CI, or Vercel
 * before `expo export` / `eas build`. Do not ship with localhost or devices will call themselves.
 */
const fs = require('fs');
const path = require('path');

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));

const trim = (s) => (typeof s === 'string' ? s.trim() : '');

const apiUrl = trim(process.env.EXPO_PUBLIC_API_URL) || trim(process.env.API_URL) || 'http://localhost:5002';
const normalizedApi = apiUrl.replace(/\/$/, '');

const graphqlFromEnv =
  trim(process.env.EXPO_PUBLIC_GRAPHQL_URL) || trim(process.env.GRAPHQL_URL) || `${normalizedApi}/graphql`;
const normalizedGraphql = graphqlFromEnv.replace(/\/graphql\/?$/i, '/graphql');

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      apiUrl: normalizedApi,
      graphqlUrl: normalizedGraphql
    }
  }
};
