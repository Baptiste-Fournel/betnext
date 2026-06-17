import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { AlertIcon, CheckIcon, InfoIcon } from './icons';

const alertVariants = cva(
  'flex items-start gap-2.5 rounded-md border p-3 text-sm [&_svg]:mt-0.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        info: 'border-border bg-muted/40 text-foreground [&_svg]:text-muted-foreground',
        success: 'border-success/40 bg-success/10 text-foreground [&_svg]:text-success',
        error: 'border-destructive/40 bg-destructive/10 text-foreground [&_svg]:text-destructive',
      },
    },
    defaultVariants: { variant: 'info' },
  },
);

const ICON = { info: InfoIcon, success: CheckIcon, error: AlertIcon } as const;

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof alertVariants> {
  title?: React.ReactNode;
}

function Alert({
  className,
  variant = 'info',
  title,
  children,
  ...props
}: AlertProps): React.JSX.Element {
  const Icon = ICON[variant ?? 'info'];
  return (
    <div className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon />
      <div className="flex flex-col gap-0.5">
        {title && <p className="font-medium leading-tight">{title}</p>}
        {children && <div className="text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}

export { Alert };
