/**
 * Le test d'atomicité sur PG RÉEL tourne via `npm run test:atomicity:pg` (script Node dédié),
 * car embedded-postgres est un module ESM incompatible avec le runner Jest (CommonJS).
 * Il prouve le « zéro perte » : un échec en milieu de transaction roule TOUT en arrière
 * (solde inchangé, aucun pari, aucun event). Voir scripts/atomicity-pg.cjs.
 */
describe.skip('Atomicité PG réel (voir: npm run test:atomicity:pg)', () => {
  it('shouldRunOutsideJest_WhenAtomicityIsValidatedAgainstRealPostgres', () => {
    // When / Then
    expect(true).toBe(true);
  });
});
