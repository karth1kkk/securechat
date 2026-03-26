import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { sessionService } from '../services/sessionService';
import { GRAPHQL_URL } from '../config';

const httpLink = new HttpLink({ uri: GRAPHQL_URL });

const authLink = setContext(async (_, { headers }) => {
  const session = await sessionService.getSession();
  return {
    headers: {
      ...headers,
      Authorization: session?.jwtToken ? `Bearer ${session.jwtToken}` : undefined
    }
  };
});

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
});
