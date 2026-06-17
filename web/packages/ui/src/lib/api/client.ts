import createClient from 'openapi-fetch';
import type { paths } from '@betnext/api-contract';
import { API_BASE_URL } from '../env';
import { clearToken, getToken } from '../auth/token-store';

export const api = createClient<paths>({ baseUrl: API_BASE_URL });

api.use({
  onRequest({ request }) {
    const token = getToken();
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },
  onResponse({ response }) {
    if (response.status === 401) {
      clearToken();
    }
    return response;
  },
});
