import { motion } from "framer-motion";

type FooterTone = "neutral" | "info" | "success" | "warning" | "error";
type FooterThemeMode = "noctis" | "graphite";

interface FooterBarProps {
  languageLabel: string;
  executionStatusLabel: string;
  executionStatusTone: FooterTone;
  currentLineLabel: string;
  frameLabel: string;
  runtimeLabel: string;
  runtimeTone: FooterTone;
  appVersionLabel: string;
  themeMode: FooterThemeMode;
  onThemeToggle: () => void;
  onOpenSettings: () => void;
}

const toneColor: Record<FooterTone, string> = {
  neutral: "text-[var(--cs-text-subtle)]",
  info: "text-sky-400",
  success: "text-[var(--cs-primary-bright)]",
  warning: "text-amber-400",
  error: "text-rose-400",
};

const Dot = ({ tone }: { tone: FooterTone }) => (
  <span
    className={`inline-block h-1.5 w-1.5 rounded-full ${
      tone === "success"
        ? "bg-[var(--cs-primary-bright)]"
        : tone === "info"
          ? "bg-sky-400"
          : tone === "warning"
            ? "bg-amber-400"
            : tone === "error"
              ? "bg-rose-400"
              : "bg-[var(--cs-text-subtle)]"
    } ${tone === "info" || tone === "success" ? "animate-pulse" : ""}`}
  />
);

export const FooterBar = ({
  languageLabel,
  executionStatusLabel,
  executionStatusTone,
  currentLineLabel,
  frameLabel,
  runtimeLabel,
  runtimeTone,
  appVersionLabel,
  themeMode,
  onThemeToggle,
  onOpenSettings,
}: FooterBarProps) => (
  <motion.footer
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className="fixed inset-x-0 z-40 px-3 pb-3"
    style={{ bottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}
  >
    <div className="mx-auto flex h-9 max-w-[1900px] items-center justify-between gap-3 rounded-xl border border-[var(--cs-border)] bg-[rgba(7,9,7,0.97)] px-4 shadow-[0_8px_24px_rgba(0,0,0,0.32)] backdrop-blur-xl">
      {/* Left: compact status line — single source of truth */}
      <div className="flex min-w-0 items-center gap-2 font-mono text-[11px]">
        <Dot tone={executionStatusTone} />
        <span className="text-[var(--cs-text-muted)]">{languageLabel}</span>
        {frameLabel ? (
          <>
            <span className="text-[var(--cs-border-strong)] opacity-50">•</span>
            <span className="text-[var(--cs-text-subtle)]">{frameLabel}</span>
          </>
        ) : null}
        {currentLineLabel ? (
          <>
            <span className="text-[var(--cs-border-strong)] opacity-50">•</span>
            <span className="text-[var(--cs-text-subtle)]">{currentLineLabel}</span>
          </>
        ) : null}
        <span className="text-[var(--cs-border-strong)] opacity-50">•</span>
        <span className={toneColor[executionStatusTone]}>{executionStatusLabel}</span>
      </div>

      {/* Right: runtime + theme + settings — icon-only, minimal */}
      <div className="flex shrink-0 items-center gap-1">
        <span className={`font-mono text-[10px] ${toneColor[runtimeTone]} hidden md:inline`}>
          {runtimeLabel}
        </span>
        <span className="mx-1 hidden text-[var(--cs-border)] md:inline">·</span>
        <span className="font-mono text-[10px] text-[var(--cs-text-subtle)] hidden sm:inline">
          {appVersionLabel}
        </span>
        <button
          type="button"
          onClick={onThemeToggle}
          className="ml-2 flex h-6 w-6 items-center justify-center rounded-md text-[var(--cs-text-subtle)] transition hover:text-[var(--cs-text)]"
          aria-label="Toggle theme"
          title={themeMode === "noctis" ? "Switch to Graphite" : "Switch to Noctis"}
        >
          <span className="material-symbols-outlined text-[13px]">
            {themeMode === "noctis" ? "dark_mode" : "contrast"}
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--cs-text-subtle)] transition hover:text-[var(--cs-text)]"
          aria-label="Open settings"
          title="Settings"
        >
          <span className="material-symbols-outlined text-[13px]">settings</span>
        </button>
      </div>
    </div>
  </motion.footer>
);
