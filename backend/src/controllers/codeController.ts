import { Request, Response } from "express";
import {
  getCodeSnippetById,
  getCodeSnippets,
  saveCodeSnippet,
} from "../services/codeService";
import { formatServiceError } from "../utils/serviceError";
import { isSupportedLanguage } from "../types/execution";

export const saveCode = async (request: Request, response: Response) => {
  try {
    const title = String(request.body.title ?? "").trim();
    const code = String(request.body.code ?? "");
    const language = String(request.body.language ?? "").trim().toLowerCase();

    if (!request.user?.userId) {
      return response.status(401).json({ message: "Unauthorized." });
    }

    if (!title || !code.trim()) {
      return response
        .status(400)
        .json({ message: "Title and code are required." });
    }

    if (!isSupportedLanguage(language)) {
      return response
        .status(400)
        .json({ message: "Language must be javascript, python, c, cpp, or java." });
    }

    const snippet = await saveCodeSnippet(
      request.user.userId,
      title,
      language,
      code,
    );
    return response.status(201).json(snippet);
  } catch (error) {
    const formattedError = formatServiceError(error, "Unable to save code.", 400);

    return response.status(formattedError.status).json({
      message: formattedError.message,
    });
  }
};

export const getCodes = async (request: Request, response: Response) => {
  try {
    if (!request.user?.userId) {
      return response.status(401).json({ message: "Unauthorized." });
    }

    const snippets = await getCodeSnippets(request.user.userId);
    return response.json(snippets);
  } catch (error) {
    const formattedError = formatServiceError(
      error,
      "Unable to fetch snippets.",
      500,
    );

    return response.status(formattedError.status).json({
      message: formattedError.message,
    });
  }
};

export const getCodeById = async (request: Request, response: Response) => {
  try {
    if (!request.user?.userId) {
      return response.status(401).json({ message: "Unauthorized." });
    }

    const snippet = await getCodeSnippetById(
      request.user.userId,
      String(request.params.id),
    );

    return response.json(snippet);
  } catch (error) {
    const formattedError = formatServiceError(error, "Snippet not found.", 404);

    return response.status(formattedError.status).json({
      message: formattedError.message,
    });
  }
};
