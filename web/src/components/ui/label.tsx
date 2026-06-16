import * as React from 'react';
import { cn } from '@/lib/utils';

/** Label accessible (htmlFor relie au champ). Version simple sans dépendance Radix. */
const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn('text-sm font-medium leading-none', className)} {...props} />
  ),
);
Label.displayName = 'Label';

export { Label };
