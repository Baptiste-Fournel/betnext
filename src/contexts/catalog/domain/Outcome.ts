/** Issue d'un marché (ex. "victoire A", "nul"). */
export class Outcome {
  constructor(
    readonly id: string,
    readonly label: string,
  ) {}
}
