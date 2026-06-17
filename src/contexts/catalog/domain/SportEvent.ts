import { Outcome } from './Outcome';

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
