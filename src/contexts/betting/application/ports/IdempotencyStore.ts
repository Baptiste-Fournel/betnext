export const IDEMPOTENCY_STORE = Symbol('IdempotencyStore');

export interface IdempotencyEntry {
  requestHash: string;
  betId: string | null;
  lockedOdds: number | null;
  potentialGain: number | null;
}

export type ClaimOutcome = { claimed: true } | { claimed: false; existing: IdempotencyEntry };

export interface PlaceBetResult {
  betId: string;
  lockedOdds: number;
  potentialGain: number;
}

export interface IdempotencyStore {
  claim(key: string, requestHash: string): Promise<ClaimOutcome>;
  complete(key: string, result: PlaceBetResult): Promise<void>;
  release(key: string): Promise<void>;
}
