import { DomainError } from '../../../shared-kernel/domain/DomainError';

/** Le pari ferait dépasser le plafond quotidien du joueur → refus (HTTP 403). */
export class DailyCapExceededError extends DomainError {
  constructor(userId: string, dailyCap: number, dayTotalStaked: number, stake: number) {
    super(
      `Plafond quotidien dépassé pour ${userId} : ${dayTotalStaked} + ${stake} > ${dailyCap}`,
      403,
    );
    this.name = 'DailyCapExceededError';
  }
}
