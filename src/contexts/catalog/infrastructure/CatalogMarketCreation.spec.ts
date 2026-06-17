import { CatalogMarketCreation } from './CatalogMarketCreation';
import { CreateMarket } from '../application/CreateMarket';
import { InMemoryMarketCatalog } from './InMemoryMarketCatalog';

describe('CatalogMarketCreation (BET-29)', () => {
  it('shouldCreateMarketWithGeneratedOutcomeIds_WhenAdaptingCreateMarket', async () => {
    // Arrange
    const adapter = new CatalogMarketCreation(new CreateMarket(new InMemoryMarketCatalog()));

    // Act
    const created = await adapter.createMarket({
      name: 'G2 vs FNC',
      game: 'LoL',
      outcomeLabels: ['Victoire G2', 'Victoire FNC', 'Match nul'],
    });

    // Assert — id de marché + ids d'issues alignés sur l'ordre des labels
    expect(created.name).toBe('G2 vs FNC');
    expect(created.outcomes.map((o) => o.label)).toEqual([
      'Victoire G2',
      'Victoire FNC',
      'Match nul',
    ]);
    expect(created.outcomes).toHaveLength(3);
    expect(new Set(created.outcomes.map((o) => o.id)).size).toBe(3);
  });

  it('shouldPropagateDomainError_WhenMarketInvalid', async () => {
    // Arrange
    const adapter = new CatalogMarketCreation(new CreateMarket(new InMemoryMarketCatalog()));

    // Act / Assert
    await expect(
      adapter.createMarket({ name: 'x', game: 'LoL', outcomeLabels: ['seule'] }),
    ).rejects.toThrow();
  });
});
