import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const alertVariants = cva(
  // Three-column grid: [icon] [content] [action?]
  // items-start keeps the icon top-aligned with the first line of text.
  // No mt-* on the svg — any nudge pushes it below the title's top edge.
  'grid w-full grid-cols-[auto_1fr_auto] items-start gap-x-2 rounded-md px-3 py-2 text-xs [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-muted/50 text-foreground ring-1 ring-border',
        destructive: 'bg-destructive/10 text-destructive-foreground ring-1 ring-destructive/30',
        warning: 'bg-warning/10 text-warning-foreground ring-1 ring-warning/30',
        success: 'bg-success/10 text-success-foreground ring-1 ring-success/30'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = 'Alert'

// Col 2, row 1 — on the same row as the icon.
const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('font-medium leading-none', className)} {...props} />
))
AlertTitle.displayName = 'AlertTitle'

// Col 2, row 2 — col-start-2 keeps it indented under the title, not the icon.
const AlertDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('col-start-2 mt-1 leading-relaxed', className)}
    {...props}
  />
))
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription }
