import { parse } from "acorn";
import { formatRuntimeValue } from "./formatRuntimeValue";
import { isUserFunctionDefinition, supportedMathMethods } from "./javascriptBuiltins";
import type {
  ExecutionStep,
  ExecutionTimeline,
  VariableSnapshot,
} from "../../types/execution";

type RuntimeNode = {
  type: string;
  loc?: {
    start: {
      line: number;
    };
  };
  [key: string]: unknown;
};

interface ScopeFrame {
  name: string;
  bindings: Map<string, unknown>;
}

class ReturnSignal {
  constructor(public value: unknown) {}
}

class BreakSignal {}

class ContinueSignal {}

const createConsole = () => ({
  log: (..._args: unknown[]) => undefined,
});

class StepInterpreter {
  private scopes: ScopeFrame[] = [{ name: "global", bindings: new Map() }];
  private readonly steps: ExecutionStep[] = [];
  private readonly output: string[] = [];
  private iterations = 0;
  private readonly maxIterations = 200;

  run(code: string): ExecutionTimeline {
    try {
      const program = parse(code, {
        ecmaVersion: "latest",
        sourceType: "script",
        locations: true,
      }) as unknown as RuntimeNode;

      this.executeProgram(program);

      if (this.steps.length === 0) {
        this.capture(1, "Program parsed successfully.");
      }

      return {
        steps: this.steps,
        output: [...this.output],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Execution failed.";

      return {
        steps: this.steps,
        output: [...this.output],
        error: message,
      };
    }
  }

  private executeProgram(program: RuntimeNode) {
    const body = (program.body as RuntimeNode[]) ?? [];

    for (const statement of body) {
      this.executeStatement(statement);
    }
  }

  private executeStatement(node: RuntimeNode) {
    switch (node.type) {
      case "VariableDeclaration":
        for (const declaration of (node.declarations as RuntimeNode[]) ?? []) {
          const id = declaration.id as RuntimeNode;
          const variableName = String(id.name);
          const initialValue = declaration.init
            ? this.evaluateExpression(declaration.init as RuntimeNode)
            : undefined;

          this.setBinding(variableName, initialValue);
          this.capture(
            this.getLine(declaration),
            `Declared ${variableName} = ${formatRuntimeValue(initialValue)}`,
          );
        }
        return;
      case "FunctionDeclaration": {
        const functionName = String((node.id as RuntimeNode)?.name ?? "anonymous");
        const params = ((node.params as RuntimeNode[]) ?? []).map((param) =>
          String((param as RuntimeNode).name),
        );

        this.setBinding(functionName, {
          kind: "user-function",
          name: functionName,
          params,
          body: node.body,
        });
        this.capture(this.getLine(node), `Registered function ${functionName}()`);
        return;
      }
      case "ExpressionStatement":
        this.evaluateExpression(node.expression as RuntimeNode);
        this.capture(this.getLine(node), "Evaluated expression.");
        return;
      case "BlockStatement":
        for (const statement of (node.body as RuntimeNode[]) ?? []) {
          this.executeStatement(statement);
        }
        return;
      case "IfStatement": {
        const outcome = Boolean(this.evaluateExpression(node.test as RuntimeNode));
        this.capture(
          this.getLine(node.test as RuntimeNode),
          `If condition resolved to ${outcome}.`,
        );

        if (outcome) {
          this.executeStatement(node.consequent as RuntimeNode);
        } else if (node.alternate) {
          this.executeStatement(node.alternate as RuntimeNode);
        }
        return;
      }
      case "WhileStatement":
        while (true) {
          this.enforceLoopLimit(node);
          const condition = Boolean(this.evaluateExpression(node.test as RuntimeNode));
          this.capture(
            this.getLine(node.test as RuntimeNode),
            `While condition resolved to ${condition}.`,
          );

          if (!condition) {
            break;
          }

          try {
            this.executeStatement(node.body as RuntimeNode);
          } catch (error) {
            if (error instanceof ContinueSignal) {
              continue;
            }

            if (error instanceof BreakSignal) {
              break;
            }

            throw error;
          }
        }
        return;
      case "ForStatement":
        if (node.init) {
          this.executeForInitializer(node.init as RuntimeNode);
        }

        while (true) {
          this.enforceLoopLimit(node);
          const condition = node.test
            ? Boolean(this.evaluateExpression(node.test as RuntimeNode))
            : true;

          this.capture(
            this.getLine(node),
            `For loop condition resolved to ${condition}.`,
          );

          if (!condition) {
            break;
          }

          try {
            this.executeStatement(node.body as RuntimeNode);
          } catch (error) {
            if (error instanceof BreakSignal) {
              break;
            }

            if (!(error instanceof ContinueSignal)) {
              throw error;
            }
          }

          if (node.update) {
            this.evaluateExpression(node.update as RuntimeNode);
            this.capture(this.getLine(node.update as RuntimeNode), "Updated loop state.");
          }
        }
        return;
      case "ReturnStatement": {
        const returnValue = node.argument
          ? this.evaluateExpression(node.argument as RuntimeNode)
          : undefined;

        this.capture(
          this.getLine(node),
          `Returned ${formatRuntimeValue(returnValue)}.`,
        );
        throw new ReturnSignal(returnValue);
      }
      case "BreakStatement":
        this.capture(this.getLine(node), "Exited the current loop.");
        throw new BreakSignal();
      case "ContinueStatement":
        this.capture(this.getLine(node), "Skipped to the next loop iteration.");
        throw new ContinueSignal();
      case "EmptyStatement":
        return;
      default:
        throw new Error(`Unsupported statement type: ${node.type}`);
    }
  }

  private executeForInitializer(node: RuntimeNode) {
    if (node.type === "VariableDeclaration") {
      this.executeStatement(node);
      return;
    }

    this.evaluateExpression(node);
  }

  private evaluateExpression(node: RuntimeNode): unknown {
    switch (node.type) {
      case "Literal":
        return node.value;
      case "Identifier":
        return this.getIdentifierValue(String(node.name), node);
      case "BinaryExpression":
        return this.applyBinaryOperator(
          String(node.operator),
          this.evaluateExpression(node.left as RuntimeNode),
          this.evaluateExpression(node.right as RuntimeNode),
        );
      case "LogicalExpression":
        return this.applyLogicalOperator(node);
      case "UnaryExpression":
        return this.applyUnaryOperator(
          String(node.operator),
          this.evaluateExpression(node.argument as RuntimeNode),
        );
      case "TemplateLiteral":
        return ((node.quasis as RuntimeNode[]) ?? []).reduce(
          (result, quasi, index) => {
            const nextChunk = String((quasi.value as { cooked?: string }).cooked ?? "");
            const expression = (node.expressions as RuntimeNode[])[index];

            return (
              result +
              nextChunk +
              (expression ? String(this.evaluateExpression(expression)) : "")
            );
          },
          "",
        );
      case "ArrayExpression":
        return ((node.elements as RuntimeNode[]) ?? []).map((element) =>
          this.evaluateExpression(element),
        );
      case "ObjectExpression": {
        const objectValue: Record<string, unknown> = {};

        for (const property of (node.properties as RuntimeNode[]) ?? []) {
          const keyNode = property.key as RuntimeNode;
          const propertyName =
            property.computed === true
              ? String(this.evaluateExpression(keyNode))
              : String(
                  keyNode.type === "Identifier" ? keyNode.name : keyNode.value,
                );

          objectValue[propertyName] = this.evaluateExpression(
            property.value as RuntimeNode,
          );
        }

        return objectValue;
      }
      case "MemberExpression":
        return this.resolveMemberExpression(node);
      case "AssignmentExpression":
        return this.applyAssignment(node);
      case "UpdateExpression":
        return this.applyUpdate(node);
      case "CallExpression":
        return this.applyCall(node);
      case "ConditionalExpression": {
        const test = Boolean(this.evaluateExpression(node.test as RuntimeNode));
        return test
          ? this.evaluateExpression(node.consequent as RuntimeNode)
          : this.evaluateExpression(node.alternate as RuntimeNode);
      }
      default:
        throw new Error(`Unsupported expression type: ${node.type}`);
    }
  }

  private applyLogicalOperator(node: RuntimeNode) {
    const left = this.evaluateExpression(node.left as RuntimeNode);
    const operator = String(node.operator);

    if (operator === "&&") {
      return left && this.evaluateExpression(node.right as RuntimeNode);
    }

    if (operator === "||") {
      return left || this.evaluateExpression(node.right as RuntimeNode);
    }

    if (operator === "??") {
      return left ?? this.evaluateExpression(node.right as RuntimeNode);
    }

    throw new Error(`Unsupported logical operator: ${operator}`);
  }

  private applyUnaryOperator(operator: string, value: unknown) {
    switch (operator) {
      case "!":
        return !value;
      case "+":
        return Number(value);
      case "-":
        return -Number(value);
      case "typeof":
        return typeof value;
      default:
        throw new Error(`Unsupported unary operator: ${operator}`);
    }
  }

  private applyBinaryOperator(
    operator: string,
    left: unknown,
    right: unknown,
  ) {
    switch (operator) {
      case "+":
        if (typeof left === "string" || typeof right === "string") {
          return String(left) + String(right);
        }

        return Number(left) + Number(right);
      case "-":
        return Number(left) - Number(right);
      case "*":
        return Number(left) * Number(right);
      case "/":
        return Number(left) / Number(right);
      case "%":
        return Number(left) % Number(right);
      case "**":
        return Number(left) ** Number(right);
      case "<":
        return this.compareValues(left, right, "<");
      case "<=":
        return this.compareValues(left, right, "<=");
      case ">":
        return this.compareValues(left, right, ">");
      case ">=":
        return this.compareValues(left, right, ">=");
      case "==":
        return left == right;
      case "===":
        return left === right;
      case "!=":
        return left != right;
      case "!==":
        return left !== right;
      default:
        throw new Error(`Unsupported binary operator: ${operator}`);
    }
  }

  private applyAssignment(node: RuntimeNode) {
    const value = this.evaluateExpression(node.right as RuntimeNode);
    const operator = String(node.operator);

    if ((node.left as RuntimeNode).type === "Identifier") {
      const identifier = String((node.left as RuntimeNode).name);
      const currentValue = this.getIdentifierValue(identifier, node.left as RuntimeNode);
      const nextValue =
        operator === "="
          ? value
          : this.applyBinaryOperator(operator.replace("=", ""), currentValue, value);

      this.assignIdentifier(identifier, nextValue);
      return nextValue;
    }

    if ((node.left as RuntimeNode).type === "MemberExpression") {
      const reference = this.resolveMemberReference(node.left as RuntimeNode);
      const currentValue = reference.container[reference.key];
      const nextValue =
        operator === "="
          ? value
          : this.applyBinaryOperator(
              operator.replace("=", ""),
              currentValue,
              value,
            );

      reference.container[reference.key] = nextValue;
      return nextValue;
    }

    throw new Error("Unsupported assignment target.");
  }

  private applyUpdate(node: RuntimeNode) {
    const operator = String(node.operator);
    const delta = operator === "++" ? 1 : -1;

    if ((node.argument as RuntimeNode).type === "Identifier") {
      const identifier = String((node.argument as RuntimeNode).name);
      const currentValue = Number(
        this.getIdentifierValue(identifier, node.argument as RuntimeNode),
      );
      const updatedValue = currentValue + delta;

      this.assignIdentifier(identifier, updatedValue);
      return node.prefix ? updatedValue : currentValue;
    }

    if ((node.argument as RuntimeNode).type === "MemberExpression") {
      const reference = this.resolveMemberReference(node.argument as RuntimeNode);
      const currentValue = Number(reference.container[reference.key]);
      const updatedValue = currentValue + delta;

      reference.container[reference.key] = updatedValue;
      return node.prefix ? updatedValue : currentValue;
    }

    throw new Error("Unsupported update target.");
  }

  private applyCall(node: RuntimeNode) {
    const args = ((node.arguments as RuntimeNode[]) ?? []).map((argument) =>
      this.evaluateExpression(argument),
    );
    const callee = node.callee as RuntimeNode;

    if (callee.type === "MemberExpression") {
      const objectNode = callee.object as RuntimeNode;
      const propertyName = this.getMemberPropertyName(callee);

      if (objectNode.type === "Identifier" && objectNode.name === "console") {
        if (propertyName !== "log") {
          throw new Error(`Unsupported console method: ${propertyName}`);
        }

        const renderedOutput = args.map((arg) => formatRuntimeValue(arg)).join(" ");
        this.output.push(renderedOutput);
        this.capture(this.getLine(node), `console.log -> ${renderedOutput}`);
        return undefined;
      }

      if (objectNode.type === "Identifier" && objectNode.name === "Math") {
        if (!supportedMathMethods.has(propertyName)) {
          throw new Error(`Unsupported Math method: ${propertyName}`);
        }

        const mathMethod = Math[propertyName as keyof Math];

        if (typeof mathMethod !== "function") {
          throw new Error(`Math.${propertyName} is not callable.`);
        }

        return Reflect.apply(
          mathMethod as (...values: number[]) => number,
          Math,
          args as number[],
        );
      }

      const callable = this.resolveMemberExpression(callee);

      if (typeof callable !== "function") {
        throw new Error("Target member is not callable.");
      }

      return callable(...args);
    }

    if (callee.type === "Identifier") {
      const callable = this.getIdentifierValue(String(callee.name), callee);

      if (isUserFunctionDefinition(callable)) {
        return this.executeUserFunction(callable, args, node);
      }

      if (typeof callable === "function") {
        return callable(...args);
      }
    }

    throw new Error("Unsupported call expression.");
  }

  private executeUserFunction(
    fn: { name: string; params: string[]; body: unknown },
    args: unknown[],
    callNode: RuntimeNode,
  ) {
    this.capture(this.getLine(callNode), `Entering ${fn.name}().`);
    this.scopes.push({ name: fn.name, bindings: new Map() });

    fn.params.forEach((param, index) => {
      this.setBinding(param, args[index]);
      this.capture(
        this.getLine(callNode),
        `Bound ${param} = ${formatRuntimeValue(args[index])}.`,
      );
    });

    try {
      this.executeStatement(fn.body as RuntimeNode);
      this.capture(this.getLine(callNode), `Exited ${fn.name}().`);
      return undefined;
    } catch (error) {
      if (error instanceof ReturnSignal) {
        this.capture(
          this.getLine(callNode),
          `${fn.name}() completed with ${formatRuntimeValue(error.value)}.`,
        );
        return error.value;
      }

      throw error;
    } finally {
      this.scopes.pop();
    }
  }

  private resolveMemberExpression(node: RuntimeNode) {
    const reference = this.resolveMemberReference(node);
    return reference.container[reference.key];
  }

  private resolveMemberReference(node: RuntimeNode) {
    const target = this.evaluateExpression(node.object as RuntimeNode);
    const propertyName = this.getMemberPropertyName(node);

    if (typeof target !== "object" || target === null) {
      throw new Error("Cannot access a property on a non-object value.");
    }

    return {
      container: target as Record<string, unknown>,
      key: propertyName,
    };
  }

  private getMemberPropertyName(node: RuntimeNode) {
    if (node.computed) {
      return String(this.evaluateExpression(node.property as RuntimeNode));
    }

    return String((node.property as RuntimeNode).name);
  }

  private getIdentifierValue(name: string, node: RuntimeNode) {
    if (name === "undefined") {
      return undefined;
    }

    if (name === "Math") {
      return Math;
    }

    if (name === "console") {
      return createConsole();
    }

    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      const binding = this.scopes[index].bindings.get(name);

      if (typeof binding !== "undefined" || this.scopes[index].bindings.has(name)) {
        return binding;
      }
    }

    throw new Error(`Undefined identifier "${name}" on line ${this.getLine(node)}.`);
  }

  private setBinding(name: string, value: unknown) {
    this.scopes[this.scopes.length - 1].bindings.set(name, value);
  }

  private assignIdentifier(name: string, value: unknown) {
    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      if (this.scopes[index].bindings.has(name)) {
        this.scopes[index].bindings.set(name, value);
        return;
      }
    }

    throw new Error(`Cannot assign to undefined identifier "${name}".`);
  }

  private enforceLoopLimit(node: RuntimeNode) {
    this.iterations += 1;

    if (this.iterations > this.maxIterations) {
      throw new Error(
        `Loop iteration limit reached near line ${this.getLine(node)}.`,
      );
    }
  }

  private capture(line: number, description: string) {
    this.steps.push({
      line,
      description,
      variables: this.collectVariables(),
      output: [...this.output],
    });
  }

  private collectVariables(): VariableSnapshot[] {
    const snapshots: VariableSnapshot[] = [];
    const seenNames = new Set<string>();

    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      for (const [name, value] of this.scopes[index].bindings.entries()) {
        if (seenNames.has(name)) {
          continue;
        }

        seenNames.add(name);
        snapshots.push({
          name,
          scope: this.scopes[index].name,
          value: formatRuntimeValue(value),
        });
      }
    }

    return snapshots.sort((left, right) => left.name.localeCompare(right.name));
  }

  private getLine(node: RuntimeNode) {
    return node.loc?.start.line ?? 1;
  }

  private compareValues(
    left: unknown,
    right: unknown,
    operator: "<" | "<=" | ">" | ">=",
  ) {
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
      }
    }

    const normalizedLeft = String(left);
    const normalizedRight = String(right);

    switch (operator) {
      case "<":
        return normalizedLeft < normalizedRight;
      case "<=":
        return normalizedLeft <= normalizedRight;
      case ">":
        return normalizedLeft > normalizedRight;
      case ">=":
        return normalizedLeft >= normalizedRight;
    }
  }
}

export const executeJavaScript = (code: string): ExecutionTimeline => {
  const interpreter = new StepInterpreter();
  return interpreter.run(code);
};
