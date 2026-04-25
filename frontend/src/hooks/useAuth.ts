import { useEffect, useState } from "react";
import { loginRequest, signupRequest } from "../utils/api";
import type { AuthResponse, User } from "../utils/types";

const TOKEN_STORAGE_KEY = "codesight-token";
const USER_STORAGE_KEY = "codesight-user";

type AuthMode = "login" | "signup";

export const useAuth = () => {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [user, setUser] = useState<User | null>(() => {
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);

    return rawUser ? (JSON.parse(rawUser) as User) : null;
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [user]);

  const persistAuth = (response: AuthResponse) => {
    setToken(response.token);
    setUser(response.user);
    return response.user;
  };

  const authenticate = async (
    mode: AuthMode,
    email: string,
    password: string,
  ) => {
    setIsAuthenticating(true);

    try {
      const response =
        mode === "signup"
          ? await signupRequest(email, password)
          : await loginRequest(email, password);

      return persistAuth(response);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return {
    token,
    user,
    isAuthenticating,
    authenticate,
    logout,
  };
};
