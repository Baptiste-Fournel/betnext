/**
 * Frontières "ready-to-split" vérifiées au build (ADR-001 / ADR-008).
 * Toute violation casse la commande `npm run boundaries` (et donc la CI).
 */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-context',
      comment:
        'Un bounded context ne peut pas importer le code interne d\'un autre contexte. ' +
        'La communication inter-contexte passe par des événements (bus/Outbox), pas par des imports.',
      severity: 'error',
      from: { path: '^src/contexts/([^/]+)/' },
      to: {
        path: '^src/contexts/([^/]+)/',
        pathNot: [
          '^src/contexts/$1/', // même contexte autorisé
        ],
      },
    },
    {
      name: 'domain-stays-pure',
      comment:
        'La couche domain ne dépend ni de application, ni de infrastructure, ni d\'un framework (hexagonal).',
      severity: 'error',
      from: { path: '/domain/' },
      to: { path: '(/application/|/infrastructure/|node_modules/@nestjs)' },
    },
    {
      name: 'application-no-infra',
      comment:
        'La couche application dépend des ports (interfaces), pas des adapters concrets d\'infrastructure.',
      severity: 'error',
      from: { path: '/application/' },
      to: { path: '/infrastructure/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
