import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import type { TimelineMarkerData, TimelineStepPreview } from "../utils/timeline";

interface TimelineTooltipProps {
  marker?: TimelineMarkerData | null;
  preview?: TimelineStepPreview | null;
  left: number;
  maxWidth: number;
}

const clampLeft = (left: number, maxWidth: number) =>
  Math.min(Math.max(left, 12), Math.max(12, maxWidth - 260));

export const TimelineTooltip = ({
  marker,
  preview,
  left,
  maxWidth,
}: TimelineTooltipProps) => {
  const x = clampLeft(left, maxWidth);
  const isMarkerTooltip = Boolean(marker);

  return (
    <AnimatePresence initial={false}>
      {marker || preview ? (
        <motion.div
          key={marker ? marker.id : `preview-${preview?.stepIndex ?? 0}`}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          style={{ left: x }}
          className="pointer-events-none absolute bottom-[calc(100%+1rem)] z-30 w-[248px]"
        >
          <div className="rounded-2xl border border-[rgba(114,255,112,0.12)] bg-[rgba(7,10,7,0.96)] px-3.5 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.42)] backdrop-blur-xl">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--cs-text-subtle)]">
              {isMarkerTooltip ? "Timeline Event" : "Step Preview"}
            </div>

            {marker ? (
              <div className="mt-2 space-y-1.5 text-sm">
                <p className="font-semibold text-[var(--cs-text)]">
                  Step {marker.stepIndex + 1}
                </p>
                <p className="font-mono text-xs text-[var(--cs-text-muted)]">
                  Line {marker.line}
                </p>
                <p className="text-[var(--cs-primary-bright)]">{marker.shortLabel}</p>
                <p className="text-xs leading-6 text-[var(--cs-text-muted)]">
                  {marker.description}
                </p>
              </div>
            ) : preview ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[var(--cs-text)]">
                    Step {preview.stepIndex + 1}
                  </p>
                  <span
                    className={clsx(
                      "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                      preview.changedVariablesCount > 0
                        ? "border-[rgba(114,255,112,0.18)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)]"
                        : "border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] text-[var(--cs-text-muted)]",
                    )}
                  >
                    {preview.changedVariablesCount} change
                    {preview.changedVariablesCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="font-mono text-xs text-[var(--cs-text-muted)]">
                  Line {preview.line}
                </p>
                <p className="rounded-xl border border-[rgba(255,255,255,0.04)] bg-black/10 px-2.5 py-2 font-mono text-[11px] leading-5 text-[var(--cs-text)]">
                  {preview.codePreview || preview.description}
                </p>
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
