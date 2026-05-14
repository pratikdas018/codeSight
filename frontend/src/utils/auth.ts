export type AuthMode = "login" | "signup";

export interface AuthValidationResult {
  email: string;
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getAuthErrorCode = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "";

const getAuthErrorText = (error: unknown) =>
  error instanceof Error ? error.message : "Authentication failed.";

export const normalizeAuthEmail = (value: string) => value.trim().toLowerCase();

export const validateEmailAddress = (value: string) => {
  const email = normalizeAuthEmail(value);

  if (!email) {
    return "Enter your email address.";
  }

  if (!EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address.";
  }

  return null;
};

export const validateAuthSubmission = (
  mode: AuthMode,
  email: string,
  password: string,
): AuthValidationResult => {
  const normalizedEmail = normalizeAuthEmail(email);
  const emailError = validateEmailAddress(normalizedEmail);

  if (emailError) {
    throw new Error(emailError);
  }

  const trimmedPassword = password.trim();

  if (!trimmedPassword) {
    throw new Error("Enter your password.");
  }

  if (mode === "signup" && trimmedPassword.length < 8) {
    throw new Error("Use at least 8 characters for your password.");
  }

  return {
    email: normalizedEmail,
    password,
  };
};

export const toAuthErrorMessage = (error: unknown) => {
  const message = getAuthErrorText(error);
  const code = getAuthErrorCode(error);
  const normalized = message.toLowerCase();

  if (
    code === "over_email_send_rate_limit" ||
    normalized.includes("email rate limit exceeded")
  ) {
    return "Signup email quota is exhausted in Supabase right now. If this address was already used, switch to Log in. Otherwise wait for the quota to reset, or configure custom SMTP / disable email confirmation in Supabase.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already been registered")
  ) {
    return "An account already exists for that email. Log in instead.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email before logging in.";
  }

  if (normalized.includes("password should be at least")) {
    return "Use a stronger password and try again.";
  }

  if (normalized.includes("rate limit")) {
    return "Too many attempts right now. Wait a moment and try again.";
  }

  return message;
};

export const isEmailNotConfirmedError = (error: unknown) =>
  getAuthErrorText(error).toLowerCase().includes("email not confirmed");

export const isRateLimitAuthError = (error: unknown) =>
  getAuthErrorText(error).toLowerCase().includes("rate limit") ||
  getAuthErrorCode(error) === "over_email_send_rate_limit";

export const isUserAlreadyRegisteredError = (error: unknown) => {
  const normalized = getAuthErrorText(error).toLowerCase();

  return (
    normalized.includes("user already registered") ||
    normalized.includes("already been registered")
  );
};
