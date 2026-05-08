import type { Session, User as SupabaseAuthUser } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { User } from "../utils/types";

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
    id: string;
    email: string;
    created_at: string;
  } | null,
): User => ({
  id: authUser.id,
  email: profile?.email ?? authUser.email ?? "",
  createdAt: profile?.created_at ?? authUser.created_at,
});

export const fetchProfile = async (authUser: SupabaseAuthUser) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, created_at")
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

  return fetchProfile(session.user);
};

export const signUpWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Unable to create your account.");
  }

  if (!data.session) {
    return {
      status: "pending_confirmation" as const,
      email,
    };
  }

  return {
    status: "authenticated" as const,
    session: data.session,
    user: await fetchProfile(data.user),
  };
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      throw new Error(
        "Please confirm your email before logging in. Check your inbox, then try again.",
      );
    }

    throw new Error(error.message);
  }

  if (!data.session || !data.user) {
    throw new Error("Unable to log in.");
  }

  return {
    status: "authenticated" as const,
    session: data.session,
    user: await fetchProfile(data.user),
  };
};

export const resendSignupConfirmation = async (email: string) => {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const signOutSession = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
};
