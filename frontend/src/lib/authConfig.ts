type BrowserWindowWithElectronEnv = Window & {
  electronAPI?: {
    env?: {
      supabaseEmailConfirmationRequired?: string;
      siteUrl?: string;
    };
  };
};

const toBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return fallback;
};

const electronEnv = (window as BrowserWindowWithElectronEnv).electronAPI?.env;

export const isEmailConfirmationRequired = toBoolean(
  import.meta.env.VITE_SUPABASE_EMAIL_CONFIRMATION_REQUIRED ??
    electronEnv?.supabaseEmailConfirmationRequired,
  true,
);

const normalizeOrigin = (value: string | undefined) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/+$/, "");
  }

  return null;
};

export const siteUrl =
  normalizeOrigin(import.meta.env.VITE_SITE_URL) ??
  normalizeOrigin(electronEnv?.siteUrl) ??
  normalizeOrigin(window.location.origin);

export const getAuthConfirmationRedirectUrl = () =>
  siteUrl ? `${siteUrl}/auth/confirm` : undefined;
