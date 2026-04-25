import { Request, Response } from "express";
import {
  getExecutionHistory,
  saveExecutionHistory,
} from "../services/historyService";
import { formatServiceError } from "../utils/serviceError";

export const saveHistory = async (request: Request, response: Response) => {
  try {
    if (!request.user?.userId) {
      return response.status(401).json({ message: "Unauthorized." });
    }

    const codeSnippetId = String(request.body.codeSnippetId ?? "").trim();
    const output = request.body.output ? String(request.body.output) : undefined;

    if (!codeSnippetId) {
      return response
        .status(400)
        .json({ message: "codeSnippetId is required." });
    }

    const historyItem = await saveExecutionHistory(
      request.user.userId,
      codeSnippetId,
      output,
    );

    return response.status(201).json(historyItem);
  } catch (error) {
    const formattedError = formatServiceError(
      error,
      "Unable to save history.",
      400,
    );

    return response.status(formattedError.status).json({
      message: formattedError.message,
    });
  }
};

export const getHistory = async (request: Request, response: Response) => {
  try {
    if (!request.user?.userId) {
      return response.status(401).json({ message: "Unauthorized." });
    }

    const history = await getExecutionHistory(request.user.userId);
    return response.json(history);
  } catch (error) {
    const formattedError = formatServiceError(
      error,
      "Unable to fetch history.",
      500,
    );

    return response.status(formattedError.status).json({
      message: formattedError.message,
    });
  }
};
