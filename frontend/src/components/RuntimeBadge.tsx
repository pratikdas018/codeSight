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
  neutral: "border-[#1f1f1f] bg-[#0a0a0a] text-[#b9ccb2]",
  info: "border-[#203924] bg-[#0d140d] text-[#dfffe5]",
  success: "border-[#203924] bg-[#0d140d] text-[#72ff70]",
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
