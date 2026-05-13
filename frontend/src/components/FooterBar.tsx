import { motion } from "framer-motion";
import { RuntimeBadge } from "./RuntimeBadge";
import { StatusIndicator } from "./StatusIndicator";

type FooterTone = "neutral" | "info" | "success" | "warning" | "error";
type FooterThemeMode = "noctis" | "graphite";

interface FooterBarProps {
  languageLabel: string;
  executionStatusLabel: string;
  executionStatusTone: FooterTone;
  executionTimeLabel: string;
  memoryUsageLabel: string;
  currentLineLabel: string;
  runtimeLabel: string;
  runtimeTone: FooterTone;
  runtimePulse?: boolean;
  runtimeIcon?: string;
  appVersionLabel: string;
  themeMode: FooterThemeMode;
  onThemeToggle: () => void;
  onOpenSettings: () => void;
}

export const FooterBar = ({
  languageLabel,
  executionStatusLabel,
  executionStatusTone,
  executionTimeLabel,
  memoryUsageLabel,
  currentLineLabel,
  runtimeLabel,
  runtimeTone,
  runtimePulse = false,
  runtimeIcon = "terminal",
  appVersionLabel,
  themeMode,
  onThemeToggle,
  onOpenSettings,
}: FooterBarProps) => (
  <motion.footer
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.24, ease: "easeOut" }}
    className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-[rgba(5,12,21,0.96)] backdrop-blur-xl"
  >
    <div className="mx-auto flex min-h-10 max-w-[1900px] items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <StatusIndicator
          icon="code"
          label="Language"
          value={languageLabel}
          compact
        />
        <StatusIndicator
          icon="play_circle"
          label="Execution"
          value={executionStatusLabel}
          tone={executionStatusTone}
          pulse={executionStatusTone === "info"}
          compact
        />
        <div className="hidden min-w-0 md:block">
          <RuntimeBadge
            label={runtimeLabel}
            tone={runtimeTone}
            pulse={runtimePulse}
            icon={runtimeIcon}
          />
        </div>
      </div>

      <div className="hidden flex-1 items-center justify-center gap-2 lg:flex">
        <StatusIndicator
          icon="timer"
          label="Exec"
          value={executionTimeLabel}
          compact
        />
        <StatusIndicator
          icon="memory_alt"
          label="Memory"
          value={memoryUsageLabel}
          compact
        />
        <StatusIndicator
          icon="format_list_numbered"
          label="Line"
          value={currentLineLabel}
          compact
        />
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <div className="hidden sm:block">
          <RuntimeBadge label={appVersionLabel} tone="neutral" icon="new_releases" />
        </div>
        <button
          type="button"
          onClick={onThemeToggle}
          className="flex h-8 items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-2.5 text-[11px] font-medium text-slate-300 transition hover:border-white/14 hover:text-white"
          aria-label="Toggle theme"
        >
          <span className="material-symbols-outlined text-[14px]">
            {themeMode === "noctis" ? "dark_mode" : "light_mode"}
          </span>
          <span className="hidden md:inline">
            {themeMode === "noctis" ? "Noctis" : "Graphite"}
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-8 items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-2.5 text-[11px] font-medium text-slate-300 transition hover:border-cyan-300/20 hover:text-white"
          aria-label="Open settings"
        >
          <span className="material-symbols-outlined text-[14px]">settings</span>
          <span className="hidden md:inline">Settings</span>
        </button>
      </div>
    </div>
  </motion.footer>
);
