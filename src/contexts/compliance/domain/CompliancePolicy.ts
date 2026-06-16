/** Instantané transmis aux règles : la mise tentée, le total déjà misé du jour, le plafond (ou null). */
export interface ComplianceSnapshot {
  userId: string;
  stake: number;
  dayTotalStaked: number;
  dailyCap: number | null;
}

/**
 * Règle de jeu responsable (Strategy/Policy — ADR-010). PURE (domaine) : `check` lève une
 * DomainError si la mise viole la règle, ne fait rien sinon. EXTERNALISÉE : ajouter une règle
 * (plafond hebdo, cooling-off) = nouveau fichier + 1 enregistrement dans le registre, ZÉRO réécriture.
 */
export interface CompliancePolicy {
  readonly key: string;
  check(snapshot: ComplianceSnapshot): void;
}
