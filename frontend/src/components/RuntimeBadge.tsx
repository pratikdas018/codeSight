import { motion } from "framer-motion";
import clsx from "clsx";

type RuntimeTone = "neutral" | "info" | "success" | "warning" | "error";

interface RuntimeBadgeProps {
  label: string;
  icon?: string;
  tone?: RuntimeTone;
  pulse?: boolean;
}

const toneClasses: Record<RuntimeTone, string> = {
  neutral: "border-white/8 bg-white/[0.03] text-slate-300",
  info: "border-cyan-300/16 bg-cyan-300/10 text-cyan-100",
  success: "border-emerald-300/18 bg-emerald-300/10 text-emerald-100",
  warning: "border-amber-300/18 bg-amber-300/10 text-amber-100",
  error: "border-rose-300/18 bg-rose-300/10 text-rose-100",
};

export const RuntimeBadge = ({
  label,
  icon = "terminal",
  tone = "neutral",
  pulse = false,
}: RuntimeBadgeProps) => (
  <motion.div
    layout
    transition={{ duration: 0.18, ease: "easeOut" }}
    className={clsx(
      "flex h-8 min-w-0 items-center gap-2 rounded-full border px-2.5 text-[11px] font-medium",
      toneClasses[tone],
    )}
  >
    <motion.span
      animate={pulse ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
      transition={
        pulse
          ? { duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
          : { duration: 0.16 }
      }
      className="material-symbols-outlined text-[14px]"
    >
      {icon}
    </motion.span>
    <span className="truncate">{label}</span>
  </motion.div>
);
