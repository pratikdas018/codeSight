import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { AppStatusScreen } from "./AppStatusScreen";
import { CodeSightLogo } from "./CodeSightLogo";
import { requireSupabase } from "../lib/supabase";
import { siteUrl } from "../lib/authConfig";

type ConfirmState =
  | {
      status: "loading";
    }
  | {
      status: "success";
      title: string;
      description: string;
    }
  | {
      status: "error";
      title: string;
      description: string;
    };

const VALID_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

const resolveQueryParam = (params: URLSearchParams, key: string) =>
  params.get(key) ?? undefined;

const getRedirectHomeUrl = () => siteUrl ?? "/";

export const AuthConfirmScreen = () => {
  const [state, setState] = useState<ConfirmState>({
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;

    const verifyConfirmation = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const tokenHash =
        resolveQueryParam(searchParams, "token_hash") ??
        resolveQueryParam(hashParams, "token_hash");
      const rawType =
        resolveQueryParam(searchParams, "type") ??
        resolveQueryParam(hashParams, "type");
      const type = VALID_OTP_TYPES.includes(rawType as EmailOtpType)
        ? (rawType as EmailOtpType)
        : null;

      if (!tokenHash || !type) {
        if (isMounted) {
          setState({
            status: "error",
            title: "Verification link is incomplete.",
            description:
              "Open the full email link again, or request a fresh confirmation email from CodeSight.",
          });
        }
        return;
      }

      try {
        const { error } = await requireSupabase().auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });

        if (error) {
          throw error;
        }

        window.history.replaceState({}, document.title, "/auth/confirm?status=confirmed");

        if (isMounted) {
          setState({
            status: "success",
            title: "Email verified successfully.",
            description:
              "Your CodeSight account is now confirmed. Return to the app and log in with your email and password.",
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The verification link is invalid or has expired.";

        if (isMounted) {
          setState({
            status: "error",
            title: "We couldn't verify this email link.",
            description: message,
          });
        }
      }
    };

    void verifyConfirmation();

    return () => {
      isMounted = false;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <AppStatusScreen
        eyebrow="Authentication"
        title="Verifying your CodeSight email."
        description="This confirmation link is being checked with Supabase."
        showSpinner
      />
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-6 py-10 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,255,65,0.14),transparent_22%),radial-gradient(circle_at_85%_12%,rgba(16,185,129,0.08),transparent_18%),linear-gradient(180deg,#060806_0%,#050505_100%)]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(32,32,32,0.55)_1px,transparent_1px),linear-gradient(to_bottom,rgba(32,32,32,0.55)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="relative z-10 w-full max-w-xl rounded-[32px] border border-[#1f1f1f] bg-[linear-gradient(180deg,rgba(18,18,18,0.96),rgba(10,10,10,0.98))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <CodeSightLogo compact />
        <div className="mt-8 text-xs uppercase tracking-[0.24em] text-[#6c7c6d]">
          Authentication
        </div>
        <h1 className="mt-4 font-['Geist'] text-3xl font-semibold tracking-[-0.04em] text-[#ebffe2]">
          {state.title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#9aad9e]">
          {state.description}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={getRedirectHomeUrl()}
            className="inline-flex items-center rounded-full border border-[#1f1f1f] bg-[#00ff41] px-4 py-2.5 text-sm font-medium text-[#041005] transition hover:brightness-105"
          >
            Open CodeSight site
          </a>
        </div>
      </div>
    </main>
  );
};
