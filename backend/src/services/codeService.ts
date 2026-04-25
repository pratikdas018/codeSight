import { prisma } from "./prisma";
import type { SupportedLanguage } from "../types/execution";

export const saveCodeSnippet = async (
  userId: string,
  title: string,
  language: SupportedLanguage,
  code: string,
) => {
  return prisma.codeSnippet.create({
    data: {
      userId,
      title,
      language,
      code,
    },
  });
};

export const getCodeSnippets = async (userId: string) => {
  return prisma.codeSnippet.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          executionHistories: true,
        },
      },
    },
  });
};

export const getCodeSnippetById = async (userId: string, id: string) => {
  const snippet = await prisma.codeSnippet.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!snippet) {
    throw new Error("Snippet not found.");
  }

  return snippet;
};
