import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CodeSightLogo } from "./CodeSightLogo";
import { isEmailConfirmationRequired } from "../lib/authConfig";
import { LoadingSpinner } from "./LoadingSpinner";
import type { Notice } from "../utils/types";
import {
  type AuthMode,
  normalizeAuthEmail,
  toAuthErrorMessage,
  validateAuthSubmission,
} from "../utils/auth";

interface AuthScreenProps {
  isAuthenticating: boolean;
  pendingConfirmationEmail: string | null;
  onAuthenticate: (
    mode: AuthMode,
    email: string,
    password: string,
  ) => Promise<
    | { status: "authenticated"; user: { email: string } }
    | { status: "pending_confirmation"; email: string }
  >;
  onResendConfirmation: (email?: string) => Promise<void>;
  onNotice: (notice: Notice) => void;
}

export const AuthScreen = ({
  isAuthenticating,
  pendingConfirmationEmail,
  onAuthenticate,
  onResendConfirmation,
  onNotice,
}: AuthScreenProps) => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const normalizedEmail = useMemo(() => normalizeAuthEmail(email), [email]);
  const emailConfirmationRequired = isEmailConfirmationRequired;
  const isSignupQuotaError =
    mode === "signup" &&
    Boolean(formError?.toLowerCase().includes("signup email quota"));
  const shouldShowPendingConfirmation =
    emailConfirmationRequired && Boolean(pendingConfirmationEmail);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    try {
      const credentials = validateAuthSubmission(mode, email, password);
      const result = await onAuthenticate(
        mode,
        credentials.email,
        credentials.password,
      );

      if (result.status === "pending_confirmation") {
        if (!emailConfirmationRequired) {
          const message =
            "Supabase still requires email confirmation. Disable Confirm email in Supabase Auth, or set VITE_SUPABASE_EMAIL_CONFIRMATION_REQUIRED=true so CodeSight matches your project.";
          setFormError(message);
          onNotice({
            tone: "error",
            message,
          });
          return;
        }

        setMode("login");
        setPassword("");
        onNotice({
          tone: "success",
          message: `Account created for ${result.email}. Confirm your inbox, then log in.`,
        });
        return;
      }

      setPassword("");
      onNotice({
        tone: "success",
        message:
          mode === "signup"
            ? `Welcome to CodeSight, ${result.user.email}.`
            : `Welcome back, ${result.user.email}.`,
      });
    } catch (error) {
      const message = toAuthErrorMessage(error);
      setFormError(message);
      onNotice({
        tone: "error",
        message,
      });
    }
  };

  const handleResendConfirmation = async () => {
    setFormError(null);
    setIsResending(true);

    try {
      const targetEmail = normalizedEmail || pendingConfirmationEmail || undefined;
      await onResendConfirmation(targetEmail);
      onNotice({
        tone: "success",
        message: `Confirmation email sent to ${targetEmail}.`,
      });
    } catch (error) {
      const message = toAuthErrorMessage(error);
      setFormError(message);
      onNotice({
        tone: "error",
        message,
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-[#ebffe2]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,255,65,0.18),transparent_22%),radial-gradient(circle_at_84%_16%,rgba(16,185,129,0.09),transparent_22%),linear-gradient(180deg,#060806_0%,#050505_100%)]" />
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,rgba(32,32,32,0.55)_1px,transparent_1px),linear-gradient(to_bottom,rgba(32,32,32,0.55)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute inset-x-0 top-0 h-px bg-[#1f1f1f]" />

      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex items-center px-6 py-10 sm:px-10 lg:px-16 xl:px-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="mx-auto w-full max-w-2xl"
          >
            <CodeSightLogo />

            <div className="mt-10 max-w-xl">
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-[#6f8a71]">
                Desktop Workspace Security
              </p>
              <h1 className="mt-4 font-['Geist'] text-[clamp(2.9rem,7vw,5.4rem)] font-semibold leading-[0.92] tracking-[-0.05em] text-[#ebffe2]">
                Sign in before the workspace wakes up.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-[#9aad9e] sm:text-lg">
                CodeSight restores your Supabase session securely, protects the
                workspace behind authentication, and brings you straight back to
                your debugging flow when you return.
              </p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                "Persistent desktop session",
                "Protected workspace access",
                "Clean Supabase auth flow",
              ].map((item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: 0.08 * index,
                    ease: "easeOut",
                  }}
                  className="rounded-[24px] border border-[#1f1f1f] bg-[rgba(14,18,14,0.88)] p-4 shadow-[0_0_30px_rgba(0,255,65,0.06)] backdrop-blur-xl"
                >
                  <div className="text-xs uppercase tracking-[0.2em] text-[#6f8a71]">
                    {index + 1 < 10 ? `0${index + 1}` : index + 1}
                  </div>
                  <div className="mt-2 text-sm font-medium leading-6 text-[#d7f7dc]">
                    {item}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.08 }}
            className="w-full max-w-md rounded-[32px] border border-[#1f1f1f] bg-[linear-gradient(180deg,rgba(16,18,16,0.98),rgba(8,10,8,0.98))] p-6 shadow-[0_35px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-[#6f8a71]">
                  Account Access
                </div>
                <h2 className="mt-2 font-['Geist'] text-2xl font-semibold tracking-[-0.03em] text-[#ebffe2]">
                  {mode === "login" ? "Welcome back" : "Create your account"}
                </h2>
              </div>
              <div className="rounded-full border border-[#203924] bg-[#0c140d] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[#72ff70] shadow-[0_0_18px_rgba(0,255,65,0.08)]">
                Secure
              </div>
            </div>

            <div className="mt-6 flex rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-1">
              {(["login", "signup"] as const).map((nextMode) => (
                <button
                  key={nextMode}
                  type="button"
                  onClick={() => {
                    setMode(nextMode);
                    setFormError(null);
                  }}
                  className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                    mode === nextMode
                      ? "bg-[#00ff41] text-[#041005] shadow-[0_0_24px_rgba(0,255,65,0.18)]"
                      : "text-[#7f9281] hover:text-[#ebffe2]"
                  }`}
                >
                  {nextMode === "login" ? "Log in" : "Sign up"}
                </button>
              ))}
            </div>

            <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#c8ddcb]">
                  Email
                </span>
                <input
                  type="text"
                  inputMode="email"
                  autoComplete={mode === "login" ? "email" : "username"}
                  spellCheck={false}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (formError) {
                      setFormError(null);
                    }
                  }}
                  placeholder="you@company.com"
                  className="w-full rounded-[20px] border border-[#1f1f1f] bg-[#0a0a0a] px-4 py-3.5 text-sm text-[#ebffe2] outline-none transition placeholder:text-[#5f735f] focus:border-[#2f5333] focus:shadow-[0_0_0_4px_rgba(0,255,65,0.08)]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#c8ddcb]">
                  Password
                </span>
                <input
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (formError) {
                      setFormError(null);
                    }
                  }}
                  placeholder={
                    mode === "login"
                      ? "Enter your password"
                      : "Use at least 8 characters"
                  }
                  className="w-full rounded-[20px] border border-[#1f1f1f] bg-[#0a0a0a] px-4 py-3.5 text-sm text-[#ebffe2] outline-none transition placeholder:text-[#5f735f] focus:border-[#2f5333] focus:shadow-[0_0_0_4px_rgba(0,255,65,0.08)]"
                />
              </label>

              <AnimatePresence initial={false}>
                {formError ? (
                  <motion.div
                    key={formError}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-[20px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                  >
                    {formError}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {isSignupQuotaError ? (
                <div className="rounded-[20px] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                  Try <span className="font-medium">Log in</span> if you already
                  signed up with this email. For new signups, the current
                  Supabase project has exhausted its email-send quota.
                </div>
              ) : null}

              {shouldShowPendingConfirmation ? (
                <div className="rounded-[24px] border border-amber-300/20 bg-amber-300/10 px-4 py-4 text-sm text-amber-100">
                  <div className="font-medium">Confirm your email first</div>
                  <div className="mt-1 leading-6">
                    We're waiting for confirmation from{" "}
                    <span className="font-medium">
                      {pendingConfirmationEmail}
                    </span>
                    .
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleResendConfirmation();
                    }}
                    disabled={isResending || isAuthenticating}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-[#0a0a0a] px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-amber-100 transition hover:bg-[#111] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isResending ? <LoadingSpinner className="h-3.5 w-3.5" /> : null}
                    Resend confirmation
                  </button>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isAuthenticating || isResending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#00ff41] px-4 py-3.5 text-sm font-medium text-[#041005] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isAuthenticating ? (
                  <>
                    <LoadingSpinner />
                    <span>
                      {mode === "login" ? "Signing you in" : "Creating account"}
                    </span>
                  </>
                ) : (
                  <span>
                    {mode === "login" ? "Log in to CodeSight" : "Create account"}
                  </span>
                )}
              </button>
            </form>

            <p className="mt-5 text-sm leading-6 text-[#6f8a71]">
              {mode === "login"
                ? "Your workspace stays locked until a valid session is restored."
                : emailConfirmationRequired
                  ? "We'll use your email to create a secure CodeSight workspace."
                  : "We'll create your CodeSight workspace and sign you in immediately."}
            </p>
          </motion.div>
        </section>
      </div>
    </main>
  );
};
