const GRAPHQL_URL = (process.env.GRAPHQL_URL?.trim() || 'http://localhost:5002/graphql').replace(/\/graphql\/?$/, '/graphql');
const API_URL = (process.env.API_URL?.trim() || 'http://localhost:5002').replace(/\/$/, '');
const SIGNALR_URL = `${API_URL}/hubs/messaging`;

export { GRAPHQL_URL, API_URL, SIGNALR_URL };
