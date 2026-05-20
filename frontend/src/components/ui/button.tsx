import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(114,255,112,0.16)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[linear-gradient(135deg,#72ff70_0%,#00ff41_100%)] px-4 py-2.5 text-[#041005] shadow-[0_0_26px_rgba(0,255,65,0.14)] hover:brightness-110",
        secondary:
          "border-[var(--cs-border)] bg-[rgba(8,10,8,0.92)] px-4 py-2.5 text-[var(--cs-text)] hover:border-[rgba(114,255,112,0.18)] hover:bg-[rgba(18,24,18,0.9)]",
        ghost:
          "border-transparent bg-transparent px-3 py-2 text-[var(--cs-text-muted)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--cs-text)]",
        outline:
          "border-[rgba(114,255,112,0.18)] bg-[rgba(10,14,10,0.72)] px-4 py-2.5 text-[var(--cs-primary-bright)] hover:bg-[rgba(18,22,18,0.92)]",
        danger:
          "border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-rose-100 hover:bg-rose-500/15",
      },
      size: {
        default: "h-10",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";
