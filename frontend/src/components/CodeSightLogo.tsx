import clsx from "clsx";

interface CodeSightLogoProps {
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
  labelClassName?: string;
}

export const CodeSightLogo = ({
  compact = false,
  iconOnly = false,
  className,
  labelClassName,
}: CodeSightLogoProps) => {
  const iconSize = compact ? 38 : 46;

  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <div
        className={clsx(
          "relative shrink-0 overflow-hidden rounded-[14px] border border-[#203924] bg-[#0b0f0b] shadow-[0_0_32px_rgba(0,255,65,0.08)]",
          compact ? "rounded-[12px]" : "",
        )}
        style={{ width: iconSize, height: iconSize }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_26%,rgba(0,255,65,0.22),transparent_38%),linear-gradient(145deg,#0f1710_0%,#060806_100%)]" />
        <svg
          viewBox="0 0 64 64"
          className="relative z-10 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="codesight-mark" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#d9ffe2" />
              <stop offset="55%" stopColor="#72ff70" />
              <stop offset="100%" stopColor="#00e639" />
            </linearGradient>
          </defs>
          <path
            d="M18 16.5h17.5c6 0 9.5 3.2 9.5 8 0 2.6-1.2 4.7-3.4 6.1 3.2 1.5 5.1 4.2 5.1 7.9 0 6.1-4.6 10-12 10H18z"
            fill="none"
            stroke="url(#codesight-mark)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4.5"
          />
          <path
            d="M18 31h17"
            fill="none"
            stroke="url(#codesight-mark)"
            strokeLinecap="round"
            strokeWidth="4.5"
          />
          <path
            d="M39.5 18 49 8.5"
            fill="none"
            stroke="#d9ffe2"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <circle cx="49.5" cy="8.5" r="3.5" fill="#72ff70" />
        </svg>
      </div>

      {iconOnly ? null : (
        <div className={clsx("min-w-0", labelClassName)}>
          <div className="font-['Geist'] text-[clamp(1.15rem,1rem+0.4vw,1.6rem)] font-semibold tracking-[-0.05em] text-[#ebffe2]">
            CodeSight
          </div>
          <div className="text-[10px] uppercase tracking-[0.38em] text-[#6f8a71]">
            Visual Debugging Workspace
          </div>
        </div>
      )}
    </div>
  );
};
