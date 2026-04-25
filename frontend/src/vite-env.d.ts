/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type SupportedLanguage = "javascript" | "python" | "c" | "cpp" | "java";

interface DesktopFilePayload {
  canceled: boolean;
  filePath?: string;
  name?: string;
  content?: string;
}

interface LocalSnippetRecord {
  id: string;
  title: string;
  language: SupportedLanguage;
  code: string;
  createdAt: string;
  filePath: string;
  source: "local";
}

type MenuAction =
  | "file:new"
  | "file:open"
  | "file:save"
  | "file:save-local-snippet"
  | "file:load-local-snippet"
  | "run:execute";

interface Window {
  electronAPI?: {
    env: {
      isElectron: boolean;
      backendUrl: string;
      platform: string;
    };
    openFile: () => Promise<DesktopFilePayload>;
    saveFile: (payload: {
      filePath: string | null;
      content: string;
      suggestedName: string;
    }) => Promise<DesktopFilePayload>;
    saveSnippetLocally: (payload: {
      title: string;
      language: SupportedLanguage;
      code: string;
    }) => Promise<LocalSnippetRecord>;
    getLocalSnippets: () => Promise<LocalSnippetRecord[]>;
    openLocalSnippet: () => Promise<{
      canceled: boolean;
      filePath?: string;
      snippet?: LocalSnippetRecord;
    }>;
    onMenuAction: (callback: (action: MenuAction) => void) => () => void;
  };
}
