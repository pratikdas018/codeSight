import { motion } from "framer-motion";
import clsx from "clsx";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

interface StatusIndicatorProps {
  icon: string;
  label: string;
  value: string;
  tone?: StatusTone;
  pulse?: boolean;
  compact?: boolean;
}

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-white/8 bg-white/[0.03] text-slate-300",
  info: "border-cyan-300/16 bg-cyan-300/10 text-cyan-100",
  success: "border-emerald-300/18 bg-emerald-300/10 text-emerald-100",
  warning: "border-amber-300/18 bg-amber-300/10 text-amber-100",
  error: "border-rose-300/18 bg-rose-300/10 text-rose-100",
};

const dotToneClasses: Record<StatusTone, string> = {
  neutral: "bg-slate-400",
  info: "bg-cyan-300",
  success: "bg-emerald-300",
  warning: "bg-amber-300",
  error: "bg-rose-300",
};

export const StatusIndicator = ({
  icon,
  label,
  value,
  tone = "neutral",
  pulse = false,
  compact = false,
}: StatusIndicatorProps) => (
  <motion.div
    layout
    transition={{ duration: 0.18, ease: "easeOut" }}
    className={clsx(
      "flex min-w-0 items-center gap-2 rounded-full border px-2.5",
      compact ? "h-8" : "h-8.5",
      toneClasses[tone],
    )}
  >
    <span className="material-symbols-outlined text-[14px] text-slate-400">
      {icon}
    </span>
    <span className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:inline">
      {label}
    </span>
    <div className="flex min-w-0 items-center gap-2">
      <motion.span
        animate={pulse ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
        transition={
          pulse
            ? { duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
            : { duration: 0.16 }
        }
        className={clsx("h-1.5 w-1.5 rounded-full", dotToneClasses[tone])}
      />
      <span className="truncate text-[11px] font-medium text-inherit">{value}</span>
    </div>
  </motion.div>
);
