'use client';

import type { components } from '@betnext/api-contract';
import { cn } from '@betnext/ui';

type Outcome = components['schemas']['OutcomeDto'];

export function OutcomeOddsButton({
  outcome,
  odds,
  opening,
  selected,
  onSelect,
}: {
  outcome: Outcome;
  odds: number | null | undefined;
  opening?: boolean;
  selected: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  const hasOdds = odds != null;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-w-[8rem] flex-1 flex-col gap-1 rounded-md border p-2.5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border bg-background hover:border-primary/50 hover:bg-accent',
      )}
    >
      <span className="truncate text-xs text-muted-foreground">{outcome.label}</span>
      {hasOdds ? (
        <span className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold tabular-nums text-primary">{odds.toFixed(2)}</span>
          {opening && (
            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              ouverture
            </span>
          )}
        </span>
      ) : (
        <span className="text-xs font-medium text-warning">indisponible</span>
      )}
    </button>
  );
}
