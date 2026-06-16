/**
 * Contrat PARTAGÉ (Shared Kernel) du contexte Responsible Gaming : vérifie et RÉSERVE la mise du
 * jour selon les règles de jeu responsable, AVANT que le pari ne soit posé. Betting le consomme via
 * ce port (aucun accès direct aux tables Compliance — frontière respectée, comme le débit Wallet).
 * Lève une DomainError si une règle refuse (ex. plafond quotidien). Appelé dans la transaction de
 * pose → la réservation est atomique avec le pari.
 */
export const STAKE_GUARD_PORT = Symbol('StakeGuardPort');

export interface StakeGuardPort {
  reserve(userId: string, stake: number, at: Date): Promise<void>;
}
