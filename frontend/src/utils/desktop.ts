import type { SupportedLanguage } from "./types";

export interface DesktopFilePayload {
  canceled: boolean;
  filePath?: string;
  name?: string;
  content?: string;
}

export interface LocalSnippetRecord {
  id: string;
  title: string;
  language: SupportedLanguage;
  code: string;
  createdAt: string;
  filePath: string;
  source: "local";
}

export type MenuAction =
  | "file:new"
  | "file:open"
  | "file:save"
  | "file:save-local-snippet"
  | "file:load-local-snippet"
  | "run:execute";

const extensionLanguageMap: Record<string, SupportedLanguage> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "javascript",
  ".tsx": "javascript",
  ".py": "python",
  ".c": "c",
  ".cc": "cpp",
  ".cpp": "cpp",
  ".cxx": "cpp",
  ".java": "java",
};

const languageExtensionMap: Record<SupportedLanguage, string> = {
  javascript: ".js",
  python: ".py",
  c: ".c",
  cpp: ".cpp",
  java: ".java",
};

export const inferLanguageFromPath = (filePath: string): SupportedLanguage => {
  const lowerCasePath = filePath.toLowerCase();

  for (const [extension, language] of Object.entries(extensionLanguageMap)) {
    if (lowerCasePath.endsWith(extension)) {
      return language;
    }
  }

  return "javascript";
};

export const buildSuggestedFileName = (
  title: string,
  language: SupportedLanguage,
) => {
  const safeTitle = (title || "untitled")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();

  return `${safeTitle}${languageExtensionMap[language]}`;
};
