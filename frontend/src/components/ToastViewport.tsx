import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import type { Notice } from "../utils/types";

interface ToastViewportProps {
  notice: Notice | null;
  onDismiss: () => void;
}

export const ToastViewport = ({
  notice,
  onDismiss,
}: ToastViewportProps) => {
  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeout = window.setTimeout(onDismiss, 4200);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [notice, onDismiss]);

  return (
    <AnimatePresence>
      {notice ? (
        <motion.div
          key={`${notice.tone}-${notice.message}`}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="pointer-events-auto fixed right-4 top-20 z-[80] w-[min(420px,calc(100vw-2rem))]"
        >
          <div
            className={clsx(
              "rounded-xl border px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl",
              notice.tone === "success"
                ? "border-emerald-400/25 bg-[#10261c]/95 text-emerald-100"
                : "border-rose-400/25 bg-[#2a1116]/95 text-rose-100",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 text-sm leading-6">{notice.message}</div>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-md px-2 py-1 text-xs uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
