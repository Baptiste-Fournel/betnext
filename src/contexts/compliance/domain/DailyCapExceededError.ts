import { DomainError } from '../../../shared-kernel/domain/DomainError';

export class DailyCapExceededError extends DomainError {
  constructor(userId: string, dailyCap: number, dayTotalStaked: number, stake: number) {
    super(
      `Plafond quotidien dépassé pour ${userId} : ${dayTotalStaked} + ${stake} > ${dailyCap}`,
      403,
    );
    this.name = 'DailyCapExceededError';
  }
}
