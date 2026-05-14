import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { AppStatusScreen } from "./AppStatusScreen";
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
    <main className="flex min-h-screen items-center justify-center bg-[#07111f] px-6 py-10 text-slate-100">
      <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,20,34,0.96),rgba(8,16,27,0.96))] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
          Authentication
        </div>
        <h1 className="mt-4 font-['Geist'] text-3xl font-semibold tracking-[-0.04em] text-white">
          {state.title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-400">
          {state.description}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={getRedirectHomeUrl()}
            className="inline-flex items-center rounded-full bg-white px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-200"
          >
            Open CodeSight site
          </a>
        </div>
      </div>
    </main>
  );
};
