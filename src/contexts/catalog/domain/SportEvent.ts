import { Outcome } from './Outcome';

/**
 * Modèle générique N-issues (ADR-009) : un événement porte une LISTE d'issues, et non un
 * teamA/teamB codé en dur (contrairement au legacy SportEvent.php:44-52). C'est ce qui permet
 * d'ajouter un jeu non-binaire (nul, course à N partants, score exact) sans toucher le modèle.
 */
export class SportEvent {
  private readonly _outcomes: Outcome[] = [];

  constructor(
    readonly id: string,
    readonly name: string,
    readonly game: string,
  ) {}

  addOutcome(outcome: Outcome): this {
    if (this._outcomes.some((o) => o.id === outcome.id)) {
      throw new Error(`Duplicate outcome ${outcome.id}`);
    }
    this._outcomes.push(outcome);
    return this;
  }

  get outcomes(): readonly Outcome[] {
    return this._outcomes;
  }
}
