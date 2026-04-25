import type { ExecutionStep, SupportedLanguage, VariableSnapshot } from "../../types/execution";

type RuntimePrimitive = number | string;
type RuntimeArrayValue = Array<RuntimePrimitive | null>;
type RuntimeValue = RuntimePrimitive | RuntimeArrayValue | null;

interface SourceLine {
  line: number;
  content: string;
}

interface FunctionParam {
  name: string;
  byReference: boolean;
}

interface FunctionDefinition {
  name: string;
  line: number;
  params: FunctionParam[];
  body: SourceLine[];
}

interface AliasTarget {
  context: ExecutionContext;
  name: string;
}

interface ExecutionContext {
  scopeName: string;
  values: Map<string, RuntimeValue>;
  aliases: Map<string, AliasTarget>;
  parent: ExecutionContext | null;
}

const maximumLoopIterations = 400;

const shouldSkipLine = (line: string) => {
  const trimmed = line.trim();

  return (
    !trimmed ||
    trimmed === "{" ||
    trimmed === "}" ||
    trimmed === "};" ||
    trimmed.startsWith("#include") ||
    trimmed.startsWith("using namespace ") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("*/")
  );
};

const countChar = (value: string, char: string) =>
  [...value].filter((item) => item === char).length;

const splitTopLevel = (value: string, delimiter: string) => {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char === "(" || char === "[" || char === "{") {
      depth += 1;
    } else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
    }

    if (char === delimiter && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
};

const serializeValue = (value: RuntimeValue): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === null ? "_" : String(item))).join(", ")}]`;
  }

  if (typeof value === "string") {
    return value.startsWith('"') && value.endsWith('"') ? value : `"${value}"`;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "null";
};

const isNumericValue = (value: RuntimeValue): value is number =>
  typeof value === "number" && Number.isFinite(value);

const normalizeStatement = (line: string) =>
  line.trim().replace(/;$/, "").trim();

const isFunctionSignature = (line: string) => {
  const trimmed = line.trim();

  if (!trimmed.includes("(") || !trimmed.includes(")") || !trimmed.includes("{")) {
    return false;
  }

  return !/^(if|for|while|switch|catch)\b/.test(trimmed);
};

const parseParams = (signature: string): FunctionParam[] => {
  const paramsMatch = signature.match(/\((.*)\)/);

  if (!paramsMatch) {
    return [];
  }

  return splitTopLevel(paramsMatch[1], ",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const nameMatch = part.match(/([A-Za-z_]\w*)\s*(?:\[\])?\s*$/);

      return {
        name: nameMatch?.[1] ?? "arg",
        byReference: part.includes("&") || /\[\]/.test(part),
      };
    });
};

const parseFunctions = (code: string) => {
  const lines = code.split(/\r?\n/).map((content, index) => ({
    line: index + 1,
    content,
  }));
  const functions = new Map<string, FunctionDefinition>();
  const globalLines: SourceLine[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];

    if (!isFunctionSignature(current.content)) {
      globalLines.push(current);
      continue;
    }

    const signature = current.content.trim();
    const nameMatch = signature.match(/([A-Za-z_]\w*)\s*\((.*)\)/);

    if (!nameMatch) {
      globalLines.push(current);
      continue;
    }

    let depth = countChar(signature, "{") - countChar(signature, "}");
    const body: SourceLine[] = [];

    index += 1;

    while (index < lines.length && depth > 0) {
      const next = lines[index];
      depth += countChar(next.content, "{");
      depth -= countChar(next.content, "}");

      if (depth >= 1 && !/^\s*}\s*$/.test(next.content.trim())) {
        body.push(next);
      }

      index += 1;
    }

    index -= 1;

    functions.set(nameMatch[1], {
      name: nameMatch[1],
      line: current.line,
      params: parseParams(signature),
      body,
    });
  }

  return { functions, globalLines };
};

class ReturnSignal {
  constructor(public readonly value: RuntimeValue) {}
}

class CompiledTraceInterpreter {
  private readonly functions: Map<string, FunctionDefinition>;
  private readonly globalLines: SourceLine[];
  private readonly rootContext: ExecutionContext = {
    scopeName: "global",
    values: new Map(),
    aliases: new Map(),
    parent: null,
  };
  private readonly steps: ExecutionStep[] = [];
  private readonly finalOutputLines: string[];
  private revealedOutputCount = 0;
  private loopIterations = 0;

  constructor(
    code: string,
    private readonly language: Extract<SupportedLanguage, "c" | "cpp" | "java">,
    outputLines: string[],
  ) {
    const parsed = parseFunctions(code);
    this.functions = parsed.functions;
    this.globalLines = parsed.globalLines;
    this.finalOutputLines = outputLines;
  }

  run() {
    this.executeLines(this.globalLines, this.rootContext);

    if (this.functions.has("main")) {
      this.executeFunction("main", [], this.rootContext, null);
    }

    return this.steps;
  }

  private executeLines(lines: SourceLine[], context: ExecutionContext) {
    for (let index = 0; index < lines.length; index += 1) {
      const current = lines[index];
      const trimmed = current.content.trim();

      if (shouldSkipLine(trimmed)) {
        continue;
      }

      if (trimmed.startsWith("for")) {
        const { bodyLines, nextIndex } = this.extractLoopBody(lines, index);
        this.executeForLoop(current, bodyLines, context);
        index = nextIndex;
        continue;
      }

      if (trimmed.startsWith("if")) {
        const condition = this.evaluateCondition(
          trimmed.slice(trimmed.indexOf("(") + 1, trimmed.lastIndexOf(")")),
          context,
        );
        this.capture(
          current.line,
          "Checked a condition to choose the next path.",
          `The condition evaluated to ${condition}, so the program ${condition ? "entered" : "skipped"} this branch.`,
          context,
        );

        if (condition) {
          const { bodyLines, nextIndex } = this.extractConditionalBody(lines, index);
          this.executeLines(bodyLines, context);
          index = nextIndex;
        } else {
          index = this.skipConditionalBody(lines, index);
        }
        continue;
      }

      this.executeStatement(current, context);
    }
  }

  private extractLoopBody(lines: SourceLine[], index: number) {
    const current = lines[index].content;

    if (current.includes("{")) {
      const bodyLines: SourceLine[] = [];
      let depth = countChar(current, "{") - countChar(current, "}");
      let nextIndex = index;

      while (nextIndex + 1 < lines.length && depth > 0) {
        nextIndex += 1;
        const next = lines[nextIndex];
        depth += countChar(next.content, "{");
        depth -= countChar(next.content, "}");

        if (depth >= 1 && !/^\s*}\s*$/.test(next.content.trim())) {
          bodyLines.push(next);
        }
      }

      return { bodyLines, nextIndex };
    }

    return { bodyLines: lines[index + 1] ? [lines[index + 1]] : [], nextIndex: index + 1 };
  }

  private extractConditionalBody(lines: SourceLine[], index: number) {
    const current = lines[index].content;

    if (current.includes("{")) {
      const bodyLines: SourceLine[] = [];
      let depth = countChar(current, "{") - countChar(current, "}");
      let nextIndex = index;

      while (nextIndex + 1 < lines.length && depth > 0) {
        nextIndex += 1;
        const next = lines[nextIndex];
        depth += countChar(next.content, "{");
        depth -= countChar(next.content, "}");

        if (depth >= 1 && !/^\s*}\s*$/.test(next.content.trim())) {
          bodyLines.push(next);
        }
      }

      return { bodyLines, nextIndex };
    }

    return { bodyLines: lines[index + 1] ? [lines[index + 1]] : [], nextIndex: index + 1 };
  }

  private skipConditionalBody(lines: SourceLine[], index: number) {
    const current = lines[index].content;

    if (!current.includes("{")) {
      return index + 1;
    }

    let depth = countChar(current, "{") - countChar(current, "}");
    let nextIndex = index;

    while (nextIndex + 1 < lines.length && depth > 0) {
      nextIndex += 1;
      depth += countChar(lines[nextIndex].content, "{");
      depth -= countChar(lines[nextIndex].content, "}");
    }

    return nextIndex;
  }

  private executeForLoop(headerLine: SourceLine, bodyLines: SourceLine[], context: ExecutionContext) {
    const match = headerLine.content.match(/for\s*\((.*);(.*);(.*)\)/);

    if (!match) {
      return;
    }

    const initializer = match[1].trim();
    const condition = match[2].trim();
    const update = match[3].trim();

    if (initializer) {
      this.executeSyntheticStatement(initializer, headerLine.line, context);
    }

    while (true) {
      this.loopIterations += 1;

      if (this.loopIterations > maximumLoopIterations) {
        this.capture(
          headerLine.line,
          "Stopped the loop to keep the walkthrough readable.",
          "The loop hit the safety limit for the educational walkthrough.",
          context,
        );
        break;
      }

      const passed = condition ? this.evaluateCondition(condition, context) : true;

      this.capture(
        headerLine.line,
        "Checked a loop and prepared the next repetition.",
        passed
          ? "The loop condition is true, so the program runs the body again."
          : "The loop condition is false, so the program exits the loop.",
        context,
      );

      if (!passed) {
        break;
      }

      this.executeLines(bodyLines, context);

      if (update) {
        this.applyUpdate(update, context);
      }
    }
  }

  private executeStatement(line: SourceLine, context: ExecutionContext) {
    const trimmed = line.content.trim();

    if (trimmed.startsWith("return")) {
      const returnExpression = normalizeStatement(trimmed.replace(/^return/, ""));
      const resolvedValue = returnExpression
        ? this.evaluateExpression(returnExpression, context)
        : null;

      this.capture(
        line.line,
        "Returned a value from the current function.",
        "This line finishes the current function and hands a result back to the caller.",
        context,
      );
      throw new ReturnSignal(resolvedValue);
    }

    if (this.handlePrint(trimmed, line.line, context)) {
      return;
    }

    if (this.handleSwap(trimmed, line.line, context)) {
      return;
    }

    if (this.handleDeclaration(trimmed, line.line, context)) {
      return;
    }

    if (this.handleArrayAssignment(trimmed, line.line, context)) {
      return;
    }

    if (this.handleScalarAssignment(trimmed, line.line, context)) {
      return;
    }

    if (this.handleFunctionCall(trimmed, line.line, context)) {
      return;
    }

    this.capture(
      line.line,
      `Executed a ${this.language === "java" ? "Java" : this.language === "cpp" ? "C++" : "C"} line.`,
      "This line is part of the program flow. Follow the variables and arrays to see what it changes.",
      context,
    );
  }

  private executeSyntheticStatement(statement: string, line: number, context: ExecutionContext) {
    const syntheticLine: SourceLine = {
      line,
      content: statement.endsWith(";") ? statement : `${statement};`,
    };
    this.executeStatement(syntheticLine, context);
  }

  private handleDeclaration(statement: string, line: number, context: ExecutionContext) {
    const arrayLiteralMatch = statement.match(
      /^(?:const\s+)?(?:[\w:<>]+\s+)+([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*=\s*\{(.+)\};?$/,
    );

    if (arrayLiteralMatch) {
      const values = splitTopLevel(arrayLiteralMatch[2], ",").map((item) => {
        const resolved = this.evaluateExpression(item, context);
        return typeof resolved === "number" || typeof resolved === "string"
          ? resolved
          : null;
      });
      this.setValue(arrayLiteralMatch[1], values, context);
      this.capture(
        line,
        `Created array ${arrayLiteralMatch[1]}.`,
        "This line builds an array with the starting values the learner sees before the algorithm begins.",
        context,
      );
      return true;
    }

    const sizedArrayMatch = statement.match(
      /^(?:const\s+)?(?:[\w:<>]+\s+)+([A-Za-z_]\w*)\s*(?:\(([^()]*)\)|\[(.+)\])\s*;?$/,
    );

    if (
      sizedArrayMatch &&
      !statement.includes("for(") &&
      !statement.includes("if(") &&
      !statement.includes("while(")
    ) {
      const sizeExpression = sizedArrayMatch[2] || sizedArrayMatch[3];
      const sizeValue = this.evaluateExpression(sizeExpression, context);

      if (typeof sizeValue === "number" && Number.isFinite(sizeValue)) {
        this.setValue(
          sizedArrayMatch[1],
          Array.from({ length: Math.max(0, sizeValue) }, () => null),
          context,
        );
        this.capture(
          line,
          `Reserved space for array ${sizedArrayMatch[1]}.`,
          "This line creates an empty array structure that will be filled as the algorithm runs.",
          context,
        );
        return true;
      }
    }

    const scalarDeclarationMatch = statement.match(
      /^(?:const\s+)?(?:(?:unsigned|signed|long|short|final|static)\s+)*(?:int|long|double|float|char|bool|string|String|auto|var|size_t|[\w:<>]+)\s+([A-Za-z_]\w*)\s*(?:=\s*(.+))?;?$/,
    );

    if (scalarDeclarationMatch) {
      const value = scalarDeclarationMatch[2]
        ? this.evaluateExpression(scalarDeclarationMatch[2], context)
        : null;
      this.setValue(scalarDeclarationMatch[1], value, context);
      this.capture(
        line,
        `Updated ${scalarDeclarationMatch[1]} in memory.`,
        "This line stores a value so the next steps can reuse it.",
        context,
      );
      return true;
    }

    return false;
  }

  private handleArrayAssignment(statement: string, line: number, context: ExecutionContext) {
    const match = statement.match(/^([A-Za-z_]\w*)\[(.+)\]\s*=\s*(.+);?$/);

    if (!match) {
      return false;
    }

    const arrayName = match[1];
    const targetIndex = this.evaluateExpression(match[2], context);
    const nextValue = this.evaluateExpression(match[3], context);
    const resolvedArray = this.getValue(arrayName, context);

    if (!Array.isArray(resolvedArray) || typeof targetIndex !== "number") {
      return false;
    }

    const updatedArray = [...resolvedArray];
    updatedArray[targetIndex] =
      typeof nextValue === "number" || typeof nextValue === "string"
        ? nextValue
        : null;
    this.setValue(arrayName, updatedArray, context);

    const sourceSummary = match[3].replace(/\s+/g, " ").trim();
    this.capture(
      line,
      `Placed a value into ${arrayName}[${targetIndex}].`,
      `This step updates index ${targetIndex} of ${arrayName} using ${sourceSummary}. Watch the token move or change in the array visualizer.`,
      context,
    );
    return true;
  }

  private handleScalarAssignment(statement: string, line: number, context: ExecutionContext) {
    const match = statement.match(/^([A-Za-z_]\w*)\s*([+\-*/]?=)\s*(.+);?$/);

    if (!match) {
      return false;
    }

    const [, name, operator, rawValue] = match;
    const resolvedValue = this.evaluateExpression(rawValue, context);

    if (operator === "=") {
      this.setValue(name, resolvedValue, context);
    } else {
      const currentValue = this.getValue(name, context);

      if (typeof currentValue === "number" && typeof resolvedValue === "number") {
        const operation = operator[0];
        const nextValue =
          operation === "+"
            ? currentValue + resolvedValue
            : operation === "-"
              ? currentValue - resolvedValue
              : operation === "*"
                ? currentValue * resolvedValue
                : currentValue / resolvedValue;
        this.setValue(name, nextValue, context);
      }
    }

    this.capture(
      line,
      `Updated ${name} in memory.`,
      "This line changes a stored value that later steps may use.",
      context,
    );
    return true;
  }

  private handleFunctionCall(statement: string, line: number, context: ExecutionContext) {
    const match = statement.match(/^(?:[A-Za-z_]\w*\s*=\s*)?([A-Za-z_]\w*)\((.*)\);?$/);

    if (!match) {
      return false;
    }

    const functionName = match[1];

    if (!this.functions.has(functionName)) {
      return false;
    }

    const args = splitTopLevel(match[2], ",");
    this.capture(
      line,
      `Called ${functionName}().`,
      "The program entered a helper function, so the next steps show what happens inside it.",
      context,
    );
    this.executeFunction(functionName, args, context, line);
    return true;
  }

  private executeFunction(
    name: string,
    args: string[],
    parentContext: ExecutionContext,
    callLine: number | null,
  ) {
    const definition = this.functions.get(name);

    if (!definition) {
      return null;
    }

    const localContext: ExecutionContext = {
      scopeName: name,
      values: new Map(),
      aliases: new Map(),
      parent: parentContext,
    };

    definition.params.forEach((param, index) => {
      const argExpression = args[index]?.trim();

      if (!argExpression) {
        localContext.values.set(param.name, null);
        return;
      }

      if (param.byReference && /^[A-Za-z_]\w*$/.test(argExpression)) {
        const owner = this.findOwningContext(argExpression, parentContext);

        if (owner) {
          localContext.aliases.set(param.name, owner);
          return;
        }
      }

      localContext.values.set(param.name, this.evaluateExpression(argExpression, parentContext));
    });

    try {
      this.executeLines(definition.body, localContext);
    } catch (error) {
      if (error instanceof ReturnSignal) {
        return error.value;
      }

      throw error;
    } finally {
      if (callLine !== null) {
        this.capture(
          callLine,
          `${name}() finished.`,
          "The helper function completed, so control returns to the calling code.",
          parentContext,
        );
      }
    }

    return null;
  }

  private handleSwap(statement: string, line: number, context: ExecutionContext) {
    const match = statement.match(/^(?:std::)?swap\s*\(\s*([A-Za-z_]\w*)\[(.+)\]\s*,\s*([A-Za-z_]\w*)\[(.+)\]\s*\);?$/);

    if (!match) {
      return false;
    }

    const leftArrayName = match[1];
    const leftIndex = this.evaluateExpression(match[2], context);
    const rightArrayName = match[3];
    const rightIndex = this.evaluateExpression(match[4], context);
    const leftArray = this.getValue(leftArrayName, context);
    const rightArray = this.getValue(rightArrayName, context);

    if (
      !Array.isArray(leftArray) ||
      !Array.isArray(rightArray) ||
      typeof leftIndex !== "number" ||
      typeof rightIndex !== "number"
    ) {
      return false;
    }

    const nextLeftArray = [...leftArray];
    const nextRightArray = leftArrayName === rightArrayName ? nextLeftArray : [...rightArray];
    const leftValue = nextLeftArray[leftIndex];
    const rightValue = nextRightArray[rightIndex];

    nextLeftArray[leftIndex] = rightValue;
    nextRightArray[rightIndex] = leftValue;

    this.setValue(leftArrayName, nextLeftArray, context);

    if (leftArrayName !== rightArrayName) {
      this.setValue(rightArrayName, nextRightArray, context);
    }

    this.capture(
      line,
      `Swapped ${leftArrayName}[${leftIndex}] with ${rightArrayName}[${rightIndex}].`,
      "This is the key visual step: the two highlighted elements exchange places in the array.",
      context,
    );
    return true;
  }

  private handlePrint(statement: string, line: number, context: ExecutionContext) {
    if (
      !statement.includes("printf(") &&
      !statement.includes("cout") &&
      !statement.includes("System.out.print")
    ) {
      return false;
    }

    if (this.finalOutputLines.length > 0) {
      this.revealedOutputCount = Math.min(
        this.finalOutputLines.length,
        this.revealedOutputCount + 1,
      );
    }

    const explanation =
      this.finalOutputLines.length > 0
        ? "This line reveals output in the console panel so the learner can compare the visualized state with the printed result."
        : "This line sends information to the output panel.";

    this.capture(
      line,
      "Sent a result to the output panel.",
      explanation,
      context,
    );
    return true;
  }

  private applyUpdate(statement: string, context: ExecutionContext) {
    const trimmed = normalizeStatement(statement);
    const incrementMatch = trimmed.match(/^([A-Za-z_]\w*)(\+\+|--)$/);

    if (incrementMatch) {
      const currentValue = this.getValue(incrementMatch[1], context);

      if (typeof currentValue === "number") {
        this.setValue(
          incrementMatch[1],
          incrementMatch[2] === "++" ? currentValue + 1 : currentValue - 1,
          context,
        );
      }
      return;
    }

    const assignmentMatch = trimmed.match(/^([A-Za-z_]\w*)\s*([+\-*/]?=)\s*(.+)$/);

    if (assignmentMatch) {
      this.handleScalarAssignment(`${trimmed};`, 1, context);
    }
  }

  private evaluateCondition(expression: string, context: ExecutionContext) {
    const operators = ["<=", ">=", "==", "!=", "<", ">"];

    for (const operator of operators) {
      const index = expression.indexOf(operator);

      if (index >= 0) {
        const left = this.evaluateExpression(expression.slice(0, index), context);
        const right = this.evaluateExpression(
          expression.slice(index + operator.length),
          context,
        );

        if (typeof left === "number" && typeof right === "number") {
          switch (operator) {
            case "<":
              return left < right;
            case "<=":
              return left <= right;
            case ">":
              return left > right;
            case ">=":
              return left >= right;
            case "==":
              return left === right;
            case "!=":
              return left !== right;
          }
        }
      }
    }

    return Boolean(this.evaluateExpression(expression, context));
  }

  private evaluateExpression(expression: string, context: ExecutionContext): RuntimeValue {
    const trimmed = normalizeStatement(expression);

    if (!trimmed) {
      return null;
    }

    if (/^-?\d+$/.test(trimmed)) {
      return Number(trimmed);
    }

    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return splitTopLevel(trimmed.slice(1, -1), ",").map((item) => {
        const resolved = this.evaluateExpression(item, context);
        return typeof resolved === "number" || typeof resolved === "string"
          ? resolved
          : null;
      });
    }

    const sizeMatch = trimmed.match(/^([A-Za-z_]\w*)\.(?:size|length)\(\)?$/);

    if (sizeMatch) {
      const arrayValue = this.getValue(sizeMatch[1], context);
      return Array.isArray(arrayValue) ? arrayValue.length : 0;
    }

    const arrayAccessMatch = trimmed.match(/^([A-Za-z_]\w*)\[(.+)\]$/);

    if (arrayAccessMatch) {
      const arrayValue = this.getValue(arrayAccessMatch[1], context);
      const indexValue = this.evaluateExpression(arrayAccessMatch[2], context);

      if (Array.isArray(arrayValue) && typeof indexValue === "number") {
        return arrayValue[indexValue] ?? null;
      }
    }

    if (/^[A-Za-z_]\w*$/.test(trimmed)) {
      return this.getValue(trimmed, context);
    }

    const numericValue = this.evaluateNumericExpression(trimmed, context);

    if (numericValue !== null) {
      return numericValue;
    }

    return trimmed;
  }

  private evaluateNumericExpression(expression: string, context: ExecutionContext) {
    let working = expression;

    working = working.replace(
      /([A-Za-z_]\w*)\.(?:size|length)\(\)?/g,
      (_match, name: string) => {
        const value = this.getValue(name, context);
        return Array.isArray(value) ? String(value.length) : "0";
      },
    );

    while (/([A-Za-z_]\w*)\[(.+?)\]/.test(working)) {
      working = working.replace(
        /([A-Za-z_]\w*)\[(.+?)\]/g,
        (_match, name: string, rawIndex: string) => {
          const arrayValue = this.getValue(name, context);
          const indexValue = this.evaluateNumericExpression(rawIndex, context);

          if (!Array.isArray(arrayValue) || indexValue === null) {
            return "0";
          }

          const item = arrayValue[indexValue];
          return typeof item === "number" ? String(item) : "0";
        },
      );
    }

    working = working.replace(/\b([A-Za-z_]\w*)\b/g, (_match, name: string) => {
      const value = this.getValue(name, context);
      return typeof value === "number" ? String(value) : "0";
    });

    if (!/^[0-9+\-*/%() ]+$/.test(working)) {
      return null;
    }

    try {
      const result = Function(`"use strict"; return (${working});`)();
      return typeof result === "number" && Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  }

  private findOwningContext(name: string, context: ExecutionContext): AliasTarget | null {
    if (context.aliases.has(name)) {
      return context.aliases.get(name) ?? null;
    }

    if (context.values.has(name)) {
      return { context, name };
    }

    return context.parent ? this.findOwningContext(name, context.parent) : null;
  }

  private getValue(name: string, context: ExecutionContext): RuntimeValue {
    if (context.aliases.has(name)) {
      const alias = context.aliases.get(name) as AliasTarget;
      return this.getValue(alias.name, alias.context);
    }

    if (context.values.has(name)) {
      return context.values.get(name) ?? null;
    }

    return context.parent ? this.getValue(name, context.parent) : null;
  }

  private setValue(name: string, value: RuntimeValue, context: ExecutionContext) {
    if (context.aliases.has(name)) {
      const alias = context.aliases.get(name) as AliasTarget;
      this.setValue(alias.name, value, alias.context);
      return;
    }

    if (context.values.has(name) || !context.parent) {
      context.values.set(name, value);
      return;
    }

    const owner = this.findOwningContext(name, context.parent);

    if (owner) {
      owner.context.values.set(owner.name, value);
      return;
    }

    context.values.set(name, value);
  }

  private capture(
    line: number,
    description: string,
    explanation: string,
    context: ExecutionContext,
  ) {
    this.steps.push({
      line,
      description,
      explanation,
      variables: this.collectVariables(context),
      output: this.finalOutputLines.slice(0, this.revealedOutputCount),
    });
  }

  private collectVariables(context: ExecutionContext): VariableSnapshot[] {
    const snapshots: VariableSnapshot[] = [];
    const seen = new Set<string>();

    let current: ExecutionContext | null = context;

    while (current) {
      for (const [name, alias] of current.aliases.entries()) {
        if (seen.has(name)) {
          continue;
        }

        seen.add(name);
        snapshots.push({
          name,
          scope: current.scopeName,
          value: serializeValue(this.getValue(alias.name, alias.context)),
        });
      }

      for (const [name, value] of current.values.entries()) {
        if (seen.has(name)) {
          continue;
        }

        seen.add(name);
        snapshots.push({
          name,
          scope: current.scopeName,
          value: serializeValue(value),
        });
      }

      current = current.parent;
    }

    return snapshots.sort((left, right) => left.name.localeCompare(right.name));
  }
}

export const createCompiledLanguageWalkthrough = (
  code: string,
  language: Extract<SupportedLanguage, "c" | "cpp" | "java">,
  outputLines: string[],
): ExecutionStep[] => {
  const interpreter = new CompiledTraceInterpreter(code, language, outputLines);
  return interpreter.run();
};
