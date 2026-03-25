import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { sessionService } from '../services/sessionService';

const httpLink = new HttpLink({ uri: 'http://localhost:5000/graphql' });

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
