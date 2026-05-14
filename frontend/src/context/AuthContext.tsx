import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseConfig, requireSupabase } from "../lib/supabase";
import {
  hydrateSessionUser,
  resendSignupConfirmation,
  restoreVerifiedSession,
  signInWithEmail,
  signOutSession,
  signUpWithEmail,
  type AuthActionResult,
} from "../services/authService";
import type { User } from "../utils/types";

type AuthMode = "login" | "signup";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  pendingConfirmationEmail: string | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  authenticate: (
    mode: AuthMode,
    email: string,
    password: string,
  ) => Promise<AuthActionResult>;
  resendConfirmation: (email?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] =
    useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!hasSupabaseConfig) {
      setIsLoading(false);
      setUser(null);
      setSession(null);
      setPendingConfirmationEmail(null);

      return () => {
        isMounted = false;
      };
    }

    const supabase = requireSupabase();

    const syncSession = async (nextSession: Session | null) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);

      try {
        const nextUser = await hydrateSessionUser(nextSession);

        if (isMounted) {
          setUser(nextUser);
          if (nextSession) {
            setPendingConfirmationEmail(null);
          }
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreVerifiedSession()
      .then((restoredSession) => syncSession(restoredSession))
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
          setUser(null);
          setSession(null);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const authenticate = async (
    mode: AuthMode,
    email: string,
    password: string,
  ) => {
    setIsAuthenticating(true);

    try {
      const result =
        mode === "signup"
          ? await signUpWithEmail(email, password)
          : await signInWithEmail(email, password);

      if (result.status === "authenticated") {
        setPendingConfirmationEmail(null);
        setSession(result.session);
        setUser(result.user);
      } else {
        setPendingConfirmationEmail(result.email);
        setSession(null);
        setUser(null);
      }

      return result;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const resendConfirmation = async (email?: string) => {
    const targetEmail = email ?? pendingConfirmationEmail;

    if (!targetEmail) {
      throw new Error("Enter your email address first.");
    }

    await resendSignupConfirmation(targetEmail);
    setPendingConfirmationEmail(targetEmail);
  };

  const logout = async () => {
    await signOutSession();
    setSession(null);
    setUser(null);
    setPendingConfirmationEmail(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      pendingConfirmationEmail,
      isLoading,
      isAuthenticating,
      authenticate,
      resendConfirmation,
      logout,
    }),
    [
      session,
      user,
      pendingConfirmationEmail,
      isLoading,
      isAuthenticating,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return value;
};
