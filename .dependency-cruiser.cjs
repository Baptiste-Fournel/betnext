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
          '^src/contexts/$1/',
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
      name: 'domain-no-tech',
      comment:
        'La couche domain reste agnostique de toute techno concrète (ORM, driver DB, broker, ' +
        'transport HTTP). Hexagonal : le domaine ne manipule que des types purs, jamais une dépendance ' +
        'd\'infrastructure — sinon on ne pourrait plus la remplacer sans réécrire le métier.',
      severity: 'error',
      from: { path: '/domain/' },
      to: { path: 'node_modules/(typeorm|pg|ioredis|bullmq|express|swagger-ui-express|opossum|dotenv)' },
    },
    {
      name: 'application-no-infra',
      comment:
        'La couche application dépend des ports (interfaces), pas des adapters concrets d\'infrastructure.',
      severity: 'error',
      from: { path: '/application/' },
      to: { path: '/infrastructure/' },
    },
    {
      name: 'application-no-tech',
      comment:
        'La couche application orchestre via des ports ; elle ne dépend d\'aucune techno d\'infrastructure ' +
        'concrète (ORM, driver DB, broker, transport). Seul @nestjs (CQRS/DI) est toléré comme couture ' +
        'd\'orchestration — le reste passe par des ports injectés.',
      severity: 'error',
      from: { path: '/application/' },
      to: { path: 'node_modules/(typeorm|pg|ioredis|bullmq|express|swagger-ui-express|opossum)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
