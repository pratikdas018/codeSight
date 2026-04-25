import { Request, Response } from "express";
import { loginUser, signupUser } from "../services/authService";
import { formatServiceError } from "../utils/serviceError";

const getAuthPayload = (request: Request) => {
  const email = String(request.body.email ?? "").trim().toLowerCase();
  const password = String(request.body.password ?? "");

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  return { email, password };
};

export const signup = async (request: Request, response: Response) => {
  try {
    const { email, password } = getAuthPayload(request);
    const result = await signupUser(email, password);

    response.status(201).json(result);
  } catch (error) {
    const formattedError = formatServiceError(error, "Unable to sign up.", 400);

    response.status(formattedError.status).json({
      message: formattedError.message,
    });
  }
};

export const login = async (request: Request, response: Response) => {
  try {
    const { email, password } = getAuthPayload(request);
    const result = await loginUser(email, password);

    response.json(result);
  } catch (error) {
    const formattedError = formatServiceError(error, "Unable to log in.", 401);

    response.status(formattedError.status).json({
      message: formattedError.message,
    });
  }
};
