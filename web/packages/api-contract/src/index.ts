/**
 * Point d'entrée du contrat : ré-exporte les types GÉNÉRÉS depuis l'OpenAPI du back (`schema.d.ts`,
 * produit par `npm run generate`). Les apps et le package UI typent CONTRE ce module — aucun type
 * écrit à la main. Régénérer après tout changement de contrat back : `npm run generate:api`.
 */
export type { paths, components, operations } from './schema';
