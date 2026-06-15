import { Bet } from '../../domain/Bet';

/** Port de persistance de l'agrégat Bet (adapter concret côté infrastructure). */
export interface BetRepository {
  save(bet: Bet): Promise<void>;
  findById(id: string): Promise<Bet | null>;
}
