export const STAKE_GUARD_PORT = Symbol('StakeGuardPort');

export interface StakeGuardPort {
  reserve(userId: string, stake: number, at: Date): Promise<void>;
}
