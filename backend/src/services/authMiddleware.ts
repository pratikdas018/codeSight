import { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "./tokenService";

export const authenticate = (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return response.status(401).json({ message: "Authentication required." });
  }

  const token = authorization.replace("Bearer ", "");

  try {
    request.user = verifyAuthToken(token);
    return next();
  } catch (error) {
    return response.status(401).json({
      message:
        error instanceof Error ? error.message : "Invalid authentication token.",
    });
  }
};
