import { Column, Entity, PrimaryColumn } from 'typeorm';
import { CatalogOutcome } from '../../application/ports/MarketCatalog';

/**
 * Marché persistant (contexte Catalog). Modèle générique N-issues : les issues sont stockées en
 * `jsonb` (liste `{id,label}`) — suffisant pour un catalogue en lecture/création simple, sans table
 * de jointure (POC). `game` est un simple attribut → ajouter un jeu = créer un marché (zéro code).
 */
@Entity('markets')
export class MarketRecord {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  name!: string;

  @Column('varchar')
  game!: string;

  @Column('jsonb', { default: () => "'[]'" })
  outcomes!: CatalogOutcome[];
}
