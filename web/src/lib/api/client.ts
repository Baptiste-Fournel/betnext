import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { API_BASE_URL } from '../env';
import { clearToken, getToken } from '../auth/token-store';

/**
 * Client API TYPÉ, généré CONTRE le contrat OpenAPI du back (`schema.d.ts`, régénéré par
 * `npm run generate:api`). Aucun type écrit à la main ; le front reste un CLIENT MINCE.
 *
 * Middleware d'AUTH (BET-20) : injecte `Authorization: Bearer <token>` sur chaque appel si un token
 * est présent, et PURGE le token sur un 401 (expiré/invalide) → le contexte d'auth ramène au login.
 */
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
      clearToken(); // notifie le contexte d'auth → retour à l'écran de login
    }
    return response;
  },
});
