import { useEffect, useRef } from "react";
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
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      dismissRef.current();
    }, 3000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [notice?.tone, notice?.message]);

  return (
    <AnimatePresence>
      {notice ? (
        <motion.div
          key={`${notice.tone}-${notice.message}`}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="pointer-events-auto fixed right-4 top-24 z-[80] w-[min(460px,calc(100vw-2rem))]"
        >
          <div
            className={clsx(
              "rounded-[24px] border px-4 py-3 shadow-[0_22px_48px_rgba(0,0,0,0.4)] backdrop-blur-2xl",
              notice.tone === "success"
                ? "border-[#203924] bg-[linear-gradient(180deg,rgba(9,18,10,0.96),rgba(6,10,6,0.98))] text-[#dfffe5]"
                : "border-rose-400/25 bg-[linear-gradient(180deg,rgba(45,12,20,0.96),rgba(26,9,14,0.96))] text-rose-100",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={clsx(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                  notice.tone === "success"
                    ? "border-[#203924] bg-[#0d140d] text-[#72ff70]"
                    : "border-rose-300/20 bg-rose-300/10 text-rose-100",
                )}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {notice.tone === "success" ? "check_circle" : "warning"}
                </span>
              </div>
              <div className="flex-1 text-sm leading-6">{notice.message}</div>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-2xl px-2 py-1 text-xs uppercase tracking-[0.12em] text-[var(--cs-text-subtle)] transition hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--cs-text)]"
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
