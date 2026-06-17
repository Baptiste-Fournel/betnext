export const PAYMENT_GATEWAY = Symbol('PaymentGateway');

// Port de paiement externe (sortant). Vocabulaire 100 % DOMAINE : aucun champ Stripe (`id`,
// `payment_intent`, `client_secret`, `status: 'succeeded'`…) ne franchit ce port — l'adapter
// Stripe traduit (anti-corruption). Le domaine ne sait pas QUI encaisse, juste qu'on encaisse.

export interface ChargeRequest {
  // Montant dans l'unité de compte du domaine (euros), strictement positif.
  amount: number;
  // Devise ISO (ex. 'eur'). La conversion en plus petite unité (cents) reste confinée à l'adapter.
  currency: string;
  // Clé d'idempotence de la charge (ex. `deposit:<depositId>`) — garantit l'exactly-once côté
  // PSP : un retry réseau ne crée JAMAIS une seconde charge.
  idempotencyKey: string;
  // Référence interne opaque (userId/depositId) tracée côté PSP. Pas de PII.
  reference: string;
}

export interface ChargeResult {
  // Identifiant opaque de la charge, propre à notre domaine (sert ensuite au refund).
  chargeId: string;
  status: 'SUCCEEDED';
}

export interface RefundRequest {
  chargeId: string;
  // Montant à rembourser (euros).
  amount: number;
  // Clé d'idempotence du remboursement (ex. `refund:<depositId>`) — anti double-refund.
  idempotencyKey: string;
}

export interface RefundResult {
  refundId: string;
  status: 'REFUNDED';
}

export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(request: RefundRequest): Promise<RefundResult>;
}
