import { DrawerPanel } from "./DrawerPanel";

interface HelpPanelProps {
  onClose: () => void;
  open: boolean;
}

const gettingStarted = [
  "Paste code into the editor or load a starter example.",
  "Choose the runtime language from the top toolbar.",
  "Click Run Trace to capture execution frames.",
  "Use Play, Back, Next, or the timeline to follow the program.",
];

const supportedLanguages = ["C", "C++", "Java", "Python", "JavaScript"];

const visualizationFeatures = [
  "Stack memory snapshots",
  "Heap memory and composite value tracking",
  "Variable change detection and explanations",
  "Timeline playback with line-by-line sync",
];

const keyboardShortcuts = [
  "Space -> Play or pause the timeline",
  "Left / Right Arrow -> Step backward or forward",
  "Ctrl+S / Cmd+S -> Save the current workspace",
];

const runtimeRequirements = [
  "GCC for C and C++ programs",
  "JDK for Java execution",
  "Python installed for Python traces",
  "Node.js installed for JavaScript traces",
];

export const HelpPanel = ({ onClose, open }: HelpPanelProps) => (
  <DrawerPanel
    open={open}
    onClose={onClose}
    icon="help"
    title="Help & Quick Start"
    description="A beginner-friendly guide to tracing code, stepping through frames, and understanding what CodeSight is showing you."
    footer={
      <div className="rounded-2xl border border-[rgba(114,255,112,0.14)] bg-[rgba(114,255,112,0.07)] px-4 py-3 text-sm leading-6 text-[var(--cs-text-muted)]">
        Keep the editor, variables, and timeline visible together when learning a new concept. The explanation panel tells you what changed before you have to parse every symbol yourself.
      </div>
    }
  >
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
          Getting Started
        </div>
        <div className="mt-3 space-y-2">
          {gettingStarted.map((item, index) => (
            <div
              key={item}
              className="flex gap-3 rounded-2xl border border-[rgba(255,255,255,0.04)] bg-[rgba(10,13,10,0.92)] px-3.5 py-3 text-sm leading-6 text-[var(--cs-text-muted)]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(114,255,112,0.16)] bg-[rgba(114,255,112,0.08)] font-mono text-[11px] text-[var(--cs-primary-bright)]">
                {index + 1}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[1.5rem] border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
            Supported Languages
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {supportedLanguages.map((language) => (
              <span
                key={language}
                className="rounded-full border border-[rgba(114,255,112,0.14)] bg-[rgba(114,255,112,0.07)] px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[var(--cs-primary-bright)]"
              >
                {language}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
            Visualization Features
          </div>
          <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--cs-text-muted)]">
            {visualizationFeatures.map((feature) => (
              <p key={feature} className="rounded-xl bg-[rgba(10,13,10,0.92)] px-3 py-2.5">
                {feature}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
          Keyboard Shortcuts
        </div>
        <div className="mt-3 grid gap-2">
          {keyboardShortcuts.map((shortcut) => (
            <div
              key={shortcut}
              className="rounded-2xl border border-[rgba(255,255,255,0.04)] bg-[rgba(10,13,10,0.92)] px-3.5 py-3 font-mono text-xs tracking-[0.08em] text-[var(--cs-text)]"
            >
              {shortcut}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
          Runtime Requirements
        </div>
        <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--cs-text-muted)]">
          {runtimeRequirements.map((requirement) => (
            <div
              key={requirement}
              className="rounded-2xl border border-[rgba(255,255,255,0.04)] bg-[rgba(10,13,10,0.92)] px-3.5 py-3"
            >
              {requirement}
            </div>
          ))}
        </div>
      </section>
    </div>
  </DrawerPanel>
);
