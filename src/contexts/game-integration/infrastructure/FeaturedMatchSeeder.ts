import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { MATCH_LINK_STORE, MatchLink, MatchLinkStore } from '../application/ports/MatchLinkStore';
import { FEATURED_FIXTURES } from '../demo/featured-fixtures';

// Enregistre, au démarrage, les liens match↔marché des fixtures featured dans le store
// (en mémoire). Les marchés correspondants sont insérés en BDD par scripts/seed.cjs ;
// ici on ne fait QUE rétablir le lien volatil — aucune écriture argent, aucun règlement.
// Idempotent : ne réécrit pas un lien déjà présent (ex. featuré à la main entre-temps).
@Injectable()
export class FeaturedMatchSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(FeaturedMatchSeeder.name);

  constructor(@Inject(MATCH_LINK_STORE) private readonly links: MatchLinkStore) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const fixture of FEATURED_FIXTURES) {
      if (await this.links.find(fixture.matchId)) {
        continue;
      }
      const mapping: MatchLink['mapping'] = {};
      for (const outcome of fixture.market.outcomes) {
        mapping[outcome.side] = outcome.id;
      }
      await this.links.save({
        matchId: fixture.matchId,
        outcomes: fixture.market.outcomes.map((o) => o.id),
        mapping,
        marketId: fixture.market.id,
        region: fixture.region,
      });
    }
    this.logger.log(`Liens featured rétablis : ${FEATURED_FIXTURES.length}`);
  }
}
