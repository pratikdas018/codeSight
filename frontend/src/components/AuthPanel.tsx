import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import type { User } from "../utils/types";

interface AuthPanelProps {
  user: User | null;
  isAuthenticating: boolean;
  onAuthenticate: (
    mode: "login" | "signup",
    email: string,
    password: string,
  ) => Promise<void>;
  onLogout: () => void;
}

export const AuthPanel = ({
  user,
  isAuthenticating,
  onAuthenticate,
  onLogout,
}: AuthPanelProps) => {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onAuthenticate(mode, email, password);
    setPassword("");
  };

  if (user) {
    return (
      <motion.div
        layout
        className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur"
      >
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
          Signed In
        </p>
        <h2 className="mt-2 text-xl font-semibold text-ink">{user.email}</h2>
        <p className="mt-2 text-sm text-slate-600">
          Save snippets, revisit runs, and keep your learning history in sync.
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-4 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-ink hover:text-ink"
        >
          Log out
        </button>
      </motion.div>
    );
  }

  return (
    <motion.form
      layout
      onSubmit={handleSubmit}
      className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
            Account
          </p>
          <h2 className="mt-2 text-xl font-semibold text-ink">
            Save your learning trail
          </h2>
        </div>
        <div className="rounded-full bg-slate-100 p-1">
          {(["signup", "login"] as const).map((nextMode) => (
            <button
              key={nextMode}
              type="button"
              onClick={() => setMode(nextMode)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                mode === nextMode
                  ? "bg-ink text-white"
                  : "text-slate-600 hover:text-ink"
              }`}
            >
              {nextMode === "signup" ? "Sign up" : "Log in"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-glow"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-glow"
          required
          minLength={6}
        />
      </div>

      <button
        type="submit"
        disabled={isAuthenticating}
        className="mt-4 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isAuthenticating
          ? "Working..."
          : mode === "signup"
            ? "Create account"
            : "Log in"}
      </button>
    </motion.form>
  );
};
