import { cn } from '@/lib/utils';

/** Placeholder animé pour les états de chargement (pas d'écran blanc). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export { Skeleton };
