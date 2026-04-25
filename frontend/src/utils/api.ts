import type {
  AuthResponse,
  CodeSnippet,
  ExecutionHistoryRecord,
  SupportedLanguage,
} from "./types";
import type { ExecutionTrace } from "../engine/types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  window.electronAPI?.env.backendUrl ??
  "http://localhost:4000";

interface RequestOptions extends RequestInit {
  token?: string | null;
}

const request = async <T>(path: string, options: RequestOptions = {}) => {
  const { token, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
  } & T;

  if (!response.ok) {
    throw new Error(payload.message ?? "Request failed.");
  }

  return payload;
};

export const signupRequest = (email: string, password: string) =>
  request<AuthResponse>("/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const loginRequest = (email: string, password: string) =>
  request<AuthResponse>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const saveCodeRequest = (token: string, title: string, code: string) =>
  request<CodeSnippet>("/save-code", {
    method: "POST",
    token,
    body: JSON.stringify({ title, language: "javascript", code }),
  });

export const saveMultiLanguageCodeRequest = (
  token: string,
  title: string,
  language: SupportedLanguage,
  code: string,
) =>
  request<CodeSnippet>("/save-code", {
    method: "POST",
    token,
    body: JSON.stringify({ title, language, code }),
  });

export const getCodesRequest = (token: string) =>
  request<CodeSnippet[]>("/get-codes", {
    token,
  });

export const getCodeRequest = (token: string, id: string) =>
  request<CodeSnippet>(`/code/${id}`, {
    token,
  });

export const saveHistoryRequest = (
  token: string,
  codeSnippetId: string,
  output?: string,
) =>
  request<ExecutionHistoryRecord>("/save-history", {
    method: "POST",
    token,
    body: JSON.stringify({ codeSnippetId, output }),
  });

export const getHistoryRequest = (token: string) =>
  request<ExecutionHistoryRecord[]>("/history", {
    token,
  });

export const executeCodeRequest = (
  code: string,
  language: SupportedLanguage,
) =>
  request<ExecutionTrace>("/execute", {
    method: "POST",
    body: JSON.stringify({ code, language }),
  });
