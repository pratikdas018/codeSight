export interface UserFunctionDefinition {
  kind: "user-function";
  name: string;
  params: string[];
  body: unknown;
}

export const isUserFunctionDefinition = (
  value: unknown,
): value is UserFunctionDefinition =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  (value as { kind?: string }).kind === "user-function";

export const supportedMathMethods = new Set([
  "abs",
  "ceil",
  "floor",
  "max",
  "min",
  "pow",
  "random",
  "round",
  "sqrt",
]);
