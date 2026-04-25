import { Prisma } from "@prisma/client";

interface ServiceErrorResponse {
  message: string;
  status: number;
}

export const formatServiceError = (
  error: unknown,
  fallbackMessage: string,
  fallbackStatus = 500,
): ServiceErrorResponse => {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      message:
        "The local database is unavailable. Restart the backend to initialize it and try again.",
      status: 503,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        message: "That record already exists.",
        status: 409,
      };
    }

    if (error.code === "P2025") {
      return {
        message: "The requested record could not be found.",
        status: 404,
      };
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      status: fallbackStatus,
    };
  }

  return {
    message: fallbackMessage,
    status: fallbackStatus,
  };
};
