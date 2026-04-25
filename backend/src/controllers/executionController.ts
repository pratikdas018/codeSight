import { Request, Response } from "express";
import { executeCode } from "../services/executeService";
import { isSupportedLanguage, supportedLanguages } from "../types/execution";

export const execute = async (request: Request, response: Response) => {
  const code = String(request.body.code ?? "");
  const language = String(request.body.language ?? "").trim().toLowerCase();

  if (!code.trim()) {
    return response.status(400).json({
      message: "Code is required.",
    });
  }

  if (!isSupportedLanguage(language)) {
    return response.status(400).json({
      message: `Unsupported language. Choose one of: ${supportedLanguages.join(", ")}.`,
    });
  }

  try {
    const result = await executeCode(code, language);
    return response.json(result);
  } catch (error) {
    return response.status(503).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to execute code right now.",
    });
  }
};
