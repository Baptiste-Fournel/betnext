import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { API_BASE_URL } from '../env';

/**
 * Client API TYPÉ, généré CONTRE le contrat OpenAPI du back (`schema.d.ts`, régénéré par
 * `npm run generate:api`). Aucun type écrit à la main : les chemins, paramètres et réponses sont
 * vérifiés à la compilation contre le contrat. Le front reste un CLIENT MINCE (aucune logique métier).
 */
export const api = createClient<paths>({ baseUrl: API_BASE_URL });
