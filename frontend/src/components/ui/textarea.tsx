import * as React from "react";
import { cn } from "../../utils/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[120px] w-full rounded-xl border border-[var(--cs-border)] bg-[rgba(8,10,8,0.94)] px-3 py-2 text-sm text-[var(--cs-text)] outline-none transition",
      "placeholder:text-[var(--cs-text-subtle)] focus-visible:border-[rgba(114,255,112,0.24)] focus-visible:ring-4 focus-visible:ring-[rgba(114,255,112,0.06)]",
      className,
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
