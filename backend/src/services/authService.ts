import bcrypt from "bcrypt";
import { prisma } from "./prisma";
import { signAuthToken } from "./tokenService";

const sanitizeUser = (user: { id: string; email: string; createdAt: Date }) => ({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt,
});

export const signupUser = async (email: string, password: string) => {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("An account with that email already exists.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  });

  const token = signAuthToken({ userId: user.id, email: user.email });

  return {
    token,
    user: sanitizeUser(user),
  };
};

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw new Error("Invalid email or password.");
  }

  const token = signAuthToken({ userId: user.id, email: user.email });

  return {
    token,
    user: sanitizeUser(user),
  };
};
