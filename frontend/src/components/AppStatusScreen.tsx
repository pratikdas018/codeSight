import { motion } from "framer-motion";
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
  <main className="flex min-h-screen items-center justify-center bg-[#07111f] px-6 py-10 text-slate-100">
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,20,34,0.96),rgba(8,16,27,0.96))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
    >
      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
        {eyebrow}
      </div>
      <h1 className="mt-4 font-['Geist'] text-3xl font-semibold tracking-[-0.04em] text-white">
        {title}
      </h1>
      <p className="mt-4 text-sm leading-7 text-slate-400">{description}</p>
      {showSpinner ? (
        <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200">
          <LoadingSpinner />
          <span>Checking your CodeSight session</span>
        </div>
      ) : null}
    </motion.div>
  </main>
);

