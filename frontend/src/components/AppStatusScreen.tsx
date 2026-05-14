import { motion } from "framer-motion";
import { CodeSightLogo } from "./CodeSightLogo";
import { LoadingSpinner } from "./LoadingSpinner";

interface AppStatusScreenProps {
  eyebrow: string;
  title: string;
  description: string;
  showSpinner?: boolean;
}

export const AppStatusScreen = ({
  eyebrow,
  title,
  description,
  showSpinner = false,
}: AppStatusScreenProps) => (
  <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-6 py-10 text-slate-100">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,255,65,0.15),transparent_22%),radial-gradient(circle_at_85%_12%,rgba(16,185,129,0.08),transparent_18%),linear-gradient(180deg,#060806_0%,#050505_100%)]" />
    <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(32,32,32,0.55)_1px,transparent_1px),linear-gradient(to_bottom,rgba(32,32,32,0.55)_1px,transparent_1px)] [background-size:72px_72px]" />
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative z-10 w-full max-w-xl rounded-[32px] border border-[#1f1f1f] bg-[linear-gradient(180deg,rgba(18,18,18,0.96),rgba(10,10,10,0.98))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
    >
      <CodeSightLogo compact />
      <div className="mt-8 text-xs uppercase tracking-[0.24em] text-[#6c7c6d]">
        {eyebrow}
      </div>
      <h1 className="mt-4 font-['Geist'] text-3xl font-semibold tracking-[-0.04em] text-[#ebffe2]">
        {title}
      </h1>
      <p className="mt-4 text-sm leading-7 text-[#9aad9e]">{description}</p>
      {showSpinner ? (
        <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-[#1f1f1f] bg-[#0d120d] px-4 py-2.5 text-sm text-[#dfffe5] shadow-[0_0_26px_rgba(0,255,65,0.08)]">
          <LoadingSpinner />
          <span>Checking your CodeSight session</span>
        </div>
      ) : null}
    </motion.div>
  </main>
);
