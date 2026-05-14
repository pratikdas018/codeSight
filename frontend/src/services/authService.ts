import type { Session, User as SupabaseAuthUser } from "@supabase/supabase-js";
import { getAuthConfirmationRedirectUrl } from "../lib/authConfig";
import { requireSupabase } from "../lib/supabase";
import type { User } from "../utils/types";
import {
  isEmailNotConfirmedError,
  isRateLimitAuthError,
  isUserAlreadyRegisteredError,
  normalizeAuthEmail,
  toAuthErrorMessage,
} from "../utils/auth";
import { restoreVerifiedSession } from "./sessionService";

export type AuthActionResult =
  | {
      status: "authenticated";
      session: Session;
      user: User;
    }
  | {
      status: "pending_confirmation";
      email: string;
    };

const mapUser = (
  authUser: SupabaseAuthUser,
  profile?: {
    avatar_url: string | null;
    id: string;
    display_name: string | null;
    email: string;
    created_at: string;
    last_seen_at: string;
    updated_at: string;
  } | null,
): User => ({
  id: authUser.id,
  email: profile?.email ?? authUser.email ?? "",
  createdAt: profile?.created_at ?? authUser.created_at,
  updatedAt: profile?.updated_at,
  displayName: profile?.display_name,
  avatarUrl: profile?.avatar_url,
  lastSeenAt: profile?.last_seen_at,
});

const resolveUserProfile = async (authUser: SupabaseAuthUser) => {
  try {
    return await fetchProfile(authUser);
  } catch {
    return mapUser(authUser, null);
  }
};

export const fetchProfile = async (authUser: SupabaseAuthUser) => {
  const { data, error } = await requireSupabase()
    .from("profiles")
    .select(
      "id, email, display_name, avatar_url, created_at, updated_at, last_seen_at",
    )
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return mapUser(authUser, data);
};

export const hydrateSessionUser = async (session: Session | null) => {
  if (!session?.user) {
    return null;
  }

  return resolveUserProfile(session.user);
};

export const signUpWithEmail = async (email: string, password: string) => {
  const normalizedEmail = normalizeAuthEmail(email);
  const emailRedirectTo = getAuthConfirmationRedirectUrl();
  const { data, error } = await requireSupabase().auth.signUp({
    email: normalizedEmail,
    password,
    options: emailRedirectTo
      ? {
          emailRedirectTo,
        }
      : undefined,
  });

  if (error) {
    if (
      isRateLimitAuthError(error) ||
      isUserAlreadyRegisteredError(error)
    ) {
      const fallbackResult = await signInAfterSignupFailure(
        normalizedEmail,
        password,
      );

      if (fallbackResult) {
        return fallbackResult;
      }
    }

    throw new Error(toAuthErrorMessage(error));
  }

  if (!data.user) {
    throw new Error("Unable to create your account.");
  }

  if (!data.session) {
    return {
      status: "pending_confirmation" as const,
      email: normalizedEmail,
    };
  }

  return {
    status: "authenticated" as const,
    session: data.session,
    user: await resolveUserProfile(data.user),
  };
};

const signInAfterSignupFailure = async (email: string, password: string) => {
  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (isEmailNotConfirmedError(error)) {
      return {
        status: "pending_confirmation" as const,
        email,
      };
    }

    return null;
  }

  if (!data.session || !data.user) {
    return null;
  }

  return {
    status: "authenticated" as const,
    session: data.session,
    user: await resolveUserProfile(data.user),
  };
};

export const signInWithEmail = async (email: string, password: string) => {
  const normalizedEmail = normalizeAuthEmail(email);
  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    if (isEmailNotConfirmedError(error)) {
      throw new Error(
        "Please confirm your email before logging in. Check your inbox, then try again.",
      );
    }

    throw new Error(toAuthErrorMessage(error));
  }

  if (!data.session || !data.user) {
    throw new Error("Unable to log in.");
  }

  return {
    status: "authenticated" as const,
    session: data.session,
    user: await resolveUserProfile(data.user),
  };
};

export const resendSignupConfirmation = async (email: string) => {
  const normalizedEmail = normalizeAuthEmail(email);
  const emailRedirectTo = getAuthConfirmationRedirectUrl();
  const { error } = await requireSupabase().auth.resend({
    type: "signup",
    email: normalizedEmail,
    options: emailRedirectTo
      ? {
          emailRedirectTo,
        }
      : undefined,
  });

  if (error) {
    throw new Error(toAuthErrorMessage(error));
  }
};

export const signOutSession = async () => {
  const { error } = await requireSupabase().auth.signOut();

  if (error) {
    throw new Error(toAuthErrorMessage(error));
  }
};

export { restoreVerifiedSession };
