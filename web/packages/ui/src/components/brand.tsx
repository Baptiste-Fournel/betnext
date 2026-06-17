import * as React from 'react';
import { cn } from '../lib/utils';
import { BoltIcon } from './ui/icons';

export function BrandMark({
  tag,
  className,
}: {
  tag?: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <BoltIcon className="h-5 w-5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-lg font-bold tracking-tight">
          Bet<span className="text-primary">Next</span>
        </span>
        {tag && (
          <span className="mt-0.5 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
            {tag}
          </span>
        )}
      </span>
    </div>
  );
}
