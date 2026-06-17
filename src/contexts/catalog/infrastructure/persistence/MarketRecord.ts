import { Column, Entity, PrimaryColumn } from 'typeorm';
import { CatalogOutcome } from '../../application/ports/MarketCatalog';

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
