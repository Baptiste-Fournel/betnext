/**
 * Noms des files du bus (BullMQ/Redis). La communication inter-contexte passe par le BUS, jamais
 * par un appel in-process (frontière "ready-to-split"). Betting publie sur DOMAIN_EVENTS_QUEUE
 * (via le relais Outbox) ; Pricing y consomme BetPlaced et publie OddsUpdated sur ODDS_QUEUE.
 */
export const DOMAIN_EVENTS_QUEUE = 'betnext.domain-events';
export const ODDS_QUEUE = 'betnext.odds';
