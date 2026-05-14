import type { Session } from "@supabase/supabase-js";
import { requireSupabase } from "../lib/supabase";

const SESSION_EXPIRED_MESSAGE =
  "Your CodeSight session expired. Log in again to continue.";

export const requireSessionUserId = async (expectedUserId?: string) => {
  const {
    data: { session },
  } = await requireSupabase().auth.getSession();

  const sessionUserId = session?.user?.id;

  if (!sessionUserId) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  if (expectedUserId && expectedUserId !== sessionUserId) {
    throw new Error("The active CodeSight session does not match this account.");
  }

  return sessionUserId;
};

export const restoreVerifiedSession = async (): Promise<Session | null> => {
  const supabase = requireSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user || data.user.id !== session.user.id) {
    await supabase.auth.signOut();
    return null;
  }

  return session;
};
