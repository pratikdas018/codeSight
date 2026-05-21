import type {
  ChangedVariable,
  ExecutionStep,
  HeapSnapshotNode,
  StackFrameSnapshot,
  SupportedLanguage,
  TraceEventType,
  VariableSnapshot,
} from "../../types/execution";
import type { StructuredLogger } from "../../logging/logger";

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

interface SnapshotBundle {
  variables: VariableSnapshot[];
  stackFrames: StackFrameSnapshot[];
  heapState: HeapSnapshotNode[];
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
  private frameCounter = 0;
  private activeLine = 1;

  constructor(
    code: string,
    private readonly language: Extract<SupportedLanguage, "c" | "cpp" | "java">,
    outputLines: string[],
    private readonly logger?: StructuredLogger,
  ) {
    const parsed = parseFunctions(code);
    this.functions = parsed.functions;
    this.globalLines = parsed.globalLines;
    this.finalOutputLines = outputLines;
  }

  run() {
    this.logger?.trace("Starting compiled trace walkthrough.", {
      phase: "trace",
      language: this.language,
      details: {
        functionCount: this.functions.size,
        globalLineCount: this.globalLines.length,
        outputLineCount: this.finalOutputLines.length,
      },
    });

    try {
      this.executeLines(this.globalLines, this.rootContext);

      if (this.functions.has("main")) {
        this.executeFunction("main", [], this.rootContext, null);
      }

      this.logger?.trace("Compiled trace walkthrough completed.", {
        phase: "trace",
        language: this.language,
        details: {
          capturedSteps: this.steps.length,
        },
      });

      return this.steps;
    } catch (error) {
      this.logger?.error("Compiled trace walkthrough failed.", error, {
        phase: "trace",
        language: this.language,
        details: {
          capturedSteps: this.steps.length,
        },
      });
      throw error;
    }
  }

  private executeLines(lines: SourceLine[], context: ExecutionContext) {
    for (let index = 0; index < lines.length; index += 1) {
      const current = lines[index];
      const trimmed = current.content.trim();
      this.activeLine = current.line;

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
        this.captureEvent({
          line: current.line,
          codeLine: current.content,
          description: `Condition ${condition ? "passed" : "failed"}.`,
          explanation: `Condition ${trimmed.slice(trimmed.indexOf("(") + 1, trimmed.lastIndexOf(")")).trim()} evaluated to ${condition}. The program ${condition ? "enters" : "skips"} this branch.`,
          eventType: condition ? "CONDITION_TRUE" : "CONDITION_FALSE",
          context,
        });

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
      this.captureEvent({
        line: headerLine.line,
        codeLine: headerLine.content,
        description: "Loop initialization completed.",
        explanation: `Loop setup ran ${initializer.replace(/\s+/g, " ").trim()} before the first condition check.`,
        eventType: "LOOP_ENTER",
        context,
      });
    }

    while (true) {
      this.loopIterations += 1;

      if (this.loopIterations > maximumLoopIterations) {
        this.captureEvent({
          line: headerLine.line,
          codeLine: headerLine.content,
          description: "Stopped tracing this loop at the safety limit.",
          explanation: "The walkthrough reached the loop safety limit, so CodeSight stopped expanding additional iterations.",
          eventType: "LOOP_ITERATION",
          context,
        });
        break;
      }

      const passed = condition ? this.evaluateCondition(condition, context) : true;

      this.captureEvent({
        line: headerLine.line,
        codeLine: headerLine.content,
        description: `Loop condition evaluated to ${passed}.`,
        explanation: `Loop condition ${condition || "true"} evaluated to ${passed}. The ${passed ? "next iteration begins" : "loop exits"} here.`,
        eventType: passed ? "CONDITION_TRUE" : "CONDITION_FALSE",
        context,
      });

      if (!passed) {
        break;
      }

      this.captureEvent({
        line: headerLine.line,
        codeLine: headerLine.content,
        description: "Starting a new loop iteration.",
        explanation: "Control entered the loop body for the next iteration.",
        eventType: "LOOP_ITERATION",
        context,
      });
      this.executeLines(bodyLines, context);

      if (update) {
        this.applyUpdate(update, headerLine.line, headerLine.content, context);
      }
    }
  }

  private executeStatement(line: SourceLine, context: ExecutionContext) {
    const trimmed = line.content.trim();

    if (trimmed.startsWith("return")) {
      const returnExpression = normalizeStatement(trimmed.replace(/^return/, ""));
      const resolvedValue = returnExpression
        ? this.evaluateExpression(returnExpression, context, line.line)
        : null;

      this.captureEvent({
        line: line.line,
        codeLine: line.content,
        description: "Returned from the current function.",
        explanation: `${context.scopeName} returns ${serializeValue(resolvedValue)} to its caller.`,
        eventType: this.isRecursiveContext(context) ? "RECURSION_RETURN" : "FUNCTION_RETURN",
        context,
      });
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

    this.captureEvent({
      line: line.line,
      codeLine: line.content,
      description: `Executed ${normalizeStatement(line.content)}.`,
      explanation: "This step advanced control flow without a tracked variable mutation.",
      eventType: "STEP",
      context,
    });
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
      const before = this.snapshotContext(context);
      const values = splitTopLevel(arrayLiteralMatch[2], ",").map((item) => {
        const resolved = this.evaluateExpression(item, context, line);
        return typeof resolved === "number" || typeof resolved === "string"
          ? resolved
          : null;
      });
      this.setValue(arrayLiteralMatch[1], values, context);
      this.captureEvent({
        line,
        description: `Declared array ${arrayLiteralMatch[1]}.`,
        explanation: `Array ${arrayLiteralMatch[1]} was initialized with ${serializeValue(values)}.`,
        eventType: "VARIABLE_DECLARATION",
        context,
        before,
      });
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
      const sizeValue = this.evaluateExpression(sizeExpression, context, line);

      if (typeof sizeValue === "number" && Number.isFinite(sizeValue)) {
        const before = this.snapshotContext(context);
        this.setValue(
          sizedArrayMatch[1],
          Array.from({ length: Math.max(0, sizeValue) }, () => null),
          context,
        );
        this.captureEvent({
          line,
          description: `Allocated storage for ${sizedArrayMatch[1]}.`,
          explanation: `Allocated ${Math.max(0, sizeValue)} slots for ${sizedArrayMatch[1]}.`,
          eventType: "MEMORY_ALLOCATE",
          context,
          before,
        });
        return true;
      }
    }

    const scalarDeclarationMatch = statement.match(
      /^(?:const\s+)?(?:(?:unsigned|signed|long|short|final|static)\s+)*(?:int|long|double|float|char|bool|string|String|auto|var|size_t|[\w:<>]+)\s+([A-Za-z_]\w*)\s*(?:=\s*(.+))?;?$/,
    );

    if (scalarDeclarationMatch) {
      const before = this.snapshotContext(context);
      const value = scalarDeclarationMatch[2]
        ? this.evaluateExpression(scalarDeclarationMatch[2], context, line)
        : null;
      this.setValue(scalarDeclarationMatch[1], value, context);
      this.captureEvent({
        line,
        description: `Declared ${scalarDeclarationMatch[1]}.`,
        explanation: `Variable ${scalarDeclarationMatch[1]} was created with value ${serializeValue(value)}.`,
        eventType: "VARIABLE_DECLARATION",
        context,
        before,
      });
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
    const before = this.snapshotContext(context);
    const targetIndex = this.evaluateExpression(match[2], context, line);
    const nextValue = this.evaluateExpression(match[3], context, line);
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
    this.captureEvent({
      line,
      description: `Wrote ${arrayName}[${targetIndex}].`,
      explanation: `${arrayName}[${targetIndex}] changed from ${serializeValue(resolvedArray[targetIndex] ?? null)} to ${serializeValue(nextValue)} using ${sourceSummary}.`,
      eventType: "ARRAY_WRITE",
      context,
      before,
    });
    return true;
  }

  private handleScalarAssignment(statement: string, line: number, context: ExecutionContext) {
    const match = statement.match(/^([A-Za-z_]\w*)\s*([+\-*/]?=)\s*(.+);?$/);

    if (!match) {
      return false;
    }

    const [, name, operator, rawValue] = match;
    const before = this.snapshotContext(context);
    const previousValue = this.getValue(name, context);
    const resolvedValue = this.evaluateExpression(rawValue, context, line);

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

    this.captureEvent({
      line,
      description: `${operator === "=" ? "Assigned" : "Updated"} ${name}.`,
      explanation:
        operator === "="
          ? `${name} changed from ${serializeValue(previousValue)} to ${serializeValue(this.getValue(name, context))}.`
          : `${name} applied ${operator} ${rawValue.trim()} and moved from ${serializeValue(previousValue)} to ${serializeValue(this.getValue(name, context))}.`,
      eventType: operator === "=" ? "ASSIGNMENT" : "VARIABLE_UPDATE",
      context,
      before,
    });
    return true;
  }

  private handleFunctionCall(statement: string, line: number, context: ExecutionContext) {
    const match = statement.match(/^(?:([A-Za-z_]\w*)\s*=\s*)?([A-Za-z_]\w*)\((.*)\);?$/);

    if (!match) {
      return false;
    }

    const assignmentTarget = match[1];
    const functionName = match[2];

    if (!this.functions.has(functionName)) {
      return false;
    }

    const args = splitTopLevel(match[3], ",");
    this.captureEvent({
      line,
      description: `Calling ${functionName}().`,
      explanation: `Control moves into ${functionName}(${args.join(", ")}) so the helper can compute its result.`,
      eventType: this.isRecursiveCall(functionName, context)
        ? "RECURSION_ENTER"
        : "FUNCTION_CALL",
      context,
    });
    const returnValue = this.executeFunction(functionName, args, context, line);

    if (assignmentTarget) {
      const before = this.snapshotContext(context);
      const previousValue = this.getValue(assignmentTarget, context);
      this.setValue(assignmentTarget, returnValue, context);
      this.captureEvent({
        line,
        description: `Stored ${functionName}() return value in ${assignmentTarget}.`,
        explanation: `${assignmentTarget} changed from ${serializeValue(previousValue)} to ${serializeValue(returnValue)} after ${functionName}() returned.`,
        eventType: "ASSIGNMENT",
        context,
        before,
      });
    }
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

      localContext.values.set(param.name, this.evaluateExpression(argExpression, parentContext, callLine ?? definition.line));
    });

    this.captureEvent({
      line: callLine ?? definition.line,
      codeLine: callLine === null ? `${name}()` : undefined,
      description: `Entered ${name}().`,
      explanation: `${name}() started with ${definition.params.length} argument${definition.params.length === 1 ? "" : "s"} in a new stack frame.`,
      eventType: this.isRecursiveContext(localContext) ? "RECURSION_ENTER" : "FUNCTION_CALL",
      context: localContext,
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
        this.captureEvent({
          line: callLine,
          description: `${name}() finished.`,
          explanation: `${name}() completed and control returned to its caller.`,
          eventType: this.isRecursiveCall(name, localContext) ? "RECURSION_RETURN" : "FUNCTION_RETURN",
          context: parentContext,
        });
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
    const before = this.snapshotContext(context);
    const leftIndex = this.evaluateExpression(match[2], context, line);
    const rightArrayName = match[3];
    const rightIndex = this.evaluateExpression(match[4], context, line);
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

    this.captureEvent({
      line,
      description: `Swapped ${leftArrayName}[${leftIndex}] and ${rightArrayName}[${rightIndex}].`,
      explanation: `${leftArrayName}[${leftIndex}] and ${rightArrayName}[${rightIndex}] exchanged values.`,
      eventType: "ARRAY_WRITE",
      context,
      before,
    });
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

    this.captureEvent({
      line,
      description: "Wrote to stdout.",
      explanation,
      eventType: "OUTPUT",
      context,
    });
    return true;
  }

  private applyUpdate(statement: string, line: number, codeLine: string, context: ExecutionContext) {
    const trimmed = normalizeStatement(statement);
    const incrementMatch = trimmed.match(/^([A-Za-z_]\w*)(\+\+|--)$/);

    if (incrementMatch) {
      const before = this.snapshotContext(context);
      const currentValue = this.getValue(incrementMatch[1], context);

      if (typeof currentValue === "number") {
        this.setValue(
          incrementMatch[1],
          incrementMatch[2] === "++" ? currentValue + 1 : currentValue - 1,
          context,
        );
      }
      this.captureEvent({
        line,
        codeLine,
        description: `Incremented ${incrementMatch[1]}.`,
        explanation: `${incrementMatch[1]} moved from ${serializeValue(currentValue)} to ${serializeValue(this.getValue(incrementMatch[1], context))}.`,
        eventType: "LOOP_INCREMENT",
        context,
        before,
      });
      return;
    }

    const assignmentMatch = trimmed.match(/^([A-Za-z_]\w*)\s*([+\-*/]?=)\s*(.+)$/);

    if (assignmentMatch) {
      this.handleScalarAssignment(`${trimmed};`, line, context);
    }
  }

  private evaluateCondition(expression: string, context: ExecutionContext) {
    const operators = ["<=", ">=", "==", "!=", "<", ">"];

    for (const operator of operators) {
      const index = expression.indexOf(operator);

      if (index >= 0) {
        const left = this.evaluateExpression(expression.slice(0, index), context, this.activeLine);
        const right = this.evaluateExpression(
          expression.slice(index + operator.length),
          context,
          this.activeLine,
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

    return Boolean(this.evaluateExpression(expression, context, this.activeLine));
  }

  private evaluateExpression(
    expression: string,
    context: ExecutionContext,
    line = this.activeLine,
  ): RuntimeValue {
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
        const resolved = this.evaluateExpression(item, context, line);
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
      const indexValue = this.evaluateExpression(arrayAccessMatch[2], context, line);

      if (Array.isArray(arrayValue) && typeof indexValue === "number") {
        const value = arrayValue[indexValue] ?? null;
        this.captureEvent({
          line,
          description: `Read ${arrayAccessMatch[1]}[${indexValue}].`,
          explanation: `Read ${serializeValue(value)} from ${arrayAccessMatch[1]}[${indexValue}].`,
          eventType: "ARRAY_READ",
          context,
        });
        return value;
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

  private captureEvent({
    line,
    codeLine,
    description,
    explanation,
    eventType,
    context,
    before,
  }: {
    line: number;
    codeLine?: string;
    description: string;
    explanation: string;
    eventType: TraceEventType;
    context: ExecutionContext;
    before?: SnapshotBundle;
  }) {
    const after = this.snapshotContext(context);
    const variablesBefore = before?.variables ?? after.variables;
    const stackFramesBefore = before?.stackFrames ?? after.stackFrames;
    const heapStateBefore = before?.heapState ?? after.heapState;
    const changedVariables = this.diffVariables(variablesBefore, after.variables);

    this.steps.push({
      frameId: `frame-${++this.frameCounter}`,
      eventType,
      line,
      lineNumber: line,
      codeLine,
      description,
      explanation,
      variables: after.variables,
      variablesBefore,
      variablesAfter: after.variables,
      changedVariables,
      stack: after.stackFrames,
      stackFrames: after.stackFrames,
      output: this.finalOutputLines.slice(0, this.revealedOutputCount),
      heap: after.heapState,
      heapState: after.heapState,
      stdout: this.finalOutputLines.slice(0, this.revealedOutputCount),
      timestamp: this.frameCounter,
      memoryChanges: [
        ...this.diffVariables(variablesBefore, after.variables).map((change) => ({
          target: change.name,
          scope: change.scope,
          kind:
            typeof change.before === "undefined"
              ? ("added" as const)
              : typeof change.after === "undefined"
                ? ("removed" as const)
                : ("updated" as const),
          before: change.before,
          after: change.after,
        })),
      ],
      functionCalls: this.buildFunctionCalls(after.stackFrames, line),
      activeScopes: after.stackFrames.map((frame) => ({
        name: frame.name,
        variables: frame.locals,
      })),
      traceSource: "compiled-execution-interpreter",
      traceQuality: "full",
    });
  }

  private snapshotContext(context: ExecutionContext): SnapshotBundle {
    return {
      variables: this.collectVariables(context),
      stackFrames: this.collectStackFrames(context),
      heapState: this.collectHeapState(context),
    };
  }

  private diffVariables(
    before: VariableSnapshot[],
    after: VariableSnapshot[],
  ): ChangedVariable[] {
    const beforeMap = new Map(before.map((entry) => [`${entry.scope}:${entry.name}`, entry.value]));
    const afterMap = new Map(after.map((entry) => [`${entry.scope}:${entry.name}`, entry.value]));
    const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
    const changes: ChangedVariable[] = [];

    for (const key of keys) {
      const previousValue = beforeMap.get(key);
      const nextValue = afterMap.get(key);

      if (previousValue === nextValue) {
        continue;
      }

      const [scope, name] = key.split(":");
      changes.push({
        name: name ?? key,
        scope: scope ?? "global",
        before: previousValue,
        after: nextValue,
      });
    }

    return changes;
  }

  private collectHeapState(context: ExecutionContext): HeapSnapshotNode[] {
    return this.collectVariables(context)
      .filter((variable) => variable.value.startsWith("[") || variable.value.startsWith("{"))
      .map((variable) => ({
        id: `${variable.scope}:${variable.name}`,
        label: variable.name,
        type: variable.value.startsWith("[") ? "array" : "object",
        value: variable.value,
        scope: variable.scope,
      }));
  }

  private buildFunctionCalls(stackFrames: StackFrameSnapshot[], line: number) {
    return stackFrames.map((frame, index) => ({
      name: frame.name,
      event: (index === 0 ? "active" : "enter") as "active" | "enter",
      depth: index,
      lineNumber: line,
    }));
  }

  private isRecursiveCall(name: string, context: ExecutionContext) {
    let current: ExecutionContext | null = context;
    while (current) {
      if (current.scopeName === name) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  private isRecursiveContext(context: ExecutionContext) {
    return this.isRecursiveCall(context.scopeName, context.parent ?? this.rootContext);
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

  private collectStackFrames(context: ExecutionContext): StackFrameSnapshot[] {
    const frames: StackFrameSnapshot[] = [];
    let current: ExecutionContext | null = context;

    while (current) {
      const locals: VariableSnapshot[] = [];

      for (const [name, alias] of current.aliases.entries()) {
        locals.push({
          name,
          scope: current.scopeName,
          value: serializeValue(this.getValue(alias.name, alias.context)),
        });
      }

      for (const [name, value] of current.values.entries()) {
        if (locals.some((local) => local.name === name)) {
          continue;
        }

        locals.push({
          name,
          scope: current.scopeName,
          value: serializeValue(value),
        });
      }

      frames.push({
        name: current.scopeName,
        locals: locals.sort((left, right) => left.name.localeCompare(right.name)),
      });
      current = current.parent;
    }

    return frames;
  }
}

export const createCompiledLanguageWalkthrough = (
  code: string,
  language: Extract<SupportedLanguage, "c" | "cpp" | "java">,
  outputLines: string[],
  logger?: StructuredLogger,
): ExecutionStep[] => {
  const interpreter = new CompiledTraceInterpreter(code, language, outputLines, logger);
  return interpreter.run();
};
