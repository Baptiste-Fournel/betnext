import * as React from 'react';
import type { components } from '@betnext/api-contract';
import { Badge } from './ui/badge';

type BetStatus = components['schemas']['BetViewDto']['status'];

const LABEL: Record<BetStatus, string> = {
  PENDING: 'En attente',
  WON: 'Gagné',
  LOST: 'Perdu',
  VOID: 'Annulé',
  COMPENSATING: 'Compensation',
  REFUNDED: 'Remboursé',
};

const VARIANT: Record<BetStatus, React.ComponentProps<typeof Badge>['variant']> = {
  PENDING: 'warning',
  WON: 'success',
  LOST: 'destructive',
  VOID: 'secondary',
  COMPENSATING: 'warning',
  REFUNDED: 'secondary',
};

export function BetStatusBadge({ status }: { status: string }): React.JSX.Element {
  const known = status in LABEL ? (status as BetStatus) : null;
  return (
    <Badge variant={known ? VARIANT[known] : 'outline'}>{known ? LABEL[known] : status}</Badge>
  );
}
