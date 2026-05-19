import { type ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface DrawerPanelProps {
  children: ReactNode;
  description: string;
  footer?: ReactNode;
  icon: string;
  onClose: () => void;
  open: boolean;
  title: string;
}

export const DrawerPanel = ({
  children,
  description,
  footer,
  icon,
  onClose,
  open,
  title,
}: DrawerPanelProps) => {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key={title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex justify-end bg-[rgba(3,5,3,0.72)] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: 56, opacity: 0.94 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 32, opacity: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex h-full w-full max-w-[min(36rem,100vw)] flex-col border-l border-[var(--cs-border)] bg-[linear-gradient(180deg,rgba(10,13,10,0.98),rgba(6,8,6,0.98))] shadow-[-22px_0_60px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[var(--cs-border)] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(114,255,112,0.16)] bg-[rgba(114,255,112,0.08)] text-[var(--cs-primary-bright)]">
                  <span className="material-symbols-outlined text-[20px]">{icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
                    CodeSight workspace
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--cs-text)]">
                    {title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--cs-text-muted)]">
                    {description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="cs-button h-10 w-10 rounded-2xl px-0"
                  aria-label={`Close ${title}`}
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            <div className="workbench-scrollbar flex-1 overflow-y-auto px-5 py-5">
              {children}
            </div>

            {footer ? (
              <div className="border-t border-[var(--cs-border)] px-5 py-4">
                {footer}
              </div>
            ) : null}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
