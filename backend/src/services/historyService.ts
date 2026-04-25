import { prisma } from "./prisma";

export const saveExecutionHistory = async (
  userId: string,
  codeSnippetId: string,
  output?: string,
) => {
  const snippet = await prisma.codeSnippet.findFirst({
    where: {
      id: codeSnippetId,
      userId,
    },
  });

  if (!snippet) {
    throw new Error("Code snippet not found for this user.");
  }

  return prisma.executionHistory.create({
    data: {
      userId,
      codeSnippetId,
      output,
    },
    include: {
      codeSnippet: true,
    },
  });
};

export const getExecutionHistory = async (userId: string) => {
  return prisma.executionHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      codeSnippet: {
        select: {
          id: true,
          title: true,
          language: true,
          code: true,
        },
      },
    },
  });
};
