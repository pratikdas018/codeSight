import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
  {
    variants: {
      variant: {
        default:
          "border-[var(--cs-border)] bg-[rgba(255,255,255,0.03)] text-[var(--cs-text-muted)]",
        success:
          "border-[rgba(114,255,112,0.18)] bg-[rgba(114,255,112,0.08)] text-[var(--cs-primary-bright)]",
        warning:
          "border-amber-300/20 bg-amber-300/10 text-amber-100",
        danger: "border-rose-500/20 bg-rose-500/10 text-rose-100",
        info: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <div className={cn(badgeVariants({ variant }), className)} {...props} />
);
