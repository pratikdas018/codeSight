export interface LessonQuiz {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  category: string;
  level: "Beginner" | "Intermediate";
  summary: string;
  objectives: string[];
  introduction: string;
  simpleExplanation: string;
  technicalExplanation: string;
  exampleCode: string;
  exampleNotes: string;
  commonMistakes: string[];
  applications: string[];
  complexity?: string;
  quiz: LessonQuiz;
}

export const lessons: Lesson[] = [
  {
    id: "variables-and-state",
    title: "Variables and program state",
    category: "Programming fundamentals",
    level: "Beginner",
    summary: "Learn how names refer to values and how assignments change a program's state.",
    objectives: ["Describe a variable as a named binding", "Read an assignment from right to left", "Predict the final value after several assignments"],
    introduction: "Programs become useful when they can remember information. A variable gives a value a name so later instructions can use or replace it.",
    simpleExplanation: "Think of a variable as a labeled container. The label stays useful even when the value inside changes. `score = 10` puts 10 in the container named score; `score = score + 5` replaces it with 15.",
    technicalExplanation: "In JavaScript, a `let` declaration creates a mutable lexical binding. An assignment evaluates the right-hand expression first, then updates the binding. The identifier is not the value itself; it resolves to the current binding value in its lexical environment.",
    exampleCode: "let score = 10;\nscore = score + 5;\nconsole.log(score); // 15",
    exampleNotes: "The old value is read before the new value is stored. This is why the second line means 10 + 5, not an undefined self-reference.",
    commonMistakes: ["Confusing `=` assignment with `===` comparison", "Using a variable before it has been initialized", "Assuming changing one primitive variable changes every other variable"],
    applications: ["Tracking a checkout total", "Counting loop iterations", "Storing user preferences during a session"],
    quiz: { question: "What is printed by `let x = 3; x = x * 2;`?", options: ["3", "5", "6", "undefined"], answer: 2, explanation: "The right side reads 3, multiplies it by 2, and stores 6 back in x." },
  },
  {
    id: "conditions-and-branching",
    title: "Conditions and branching",
    category: "Programming fundamentals",
    level: "Beginner",
    summary: "Use boolean expressions to choose which instructions run.",
    objectives: ["Evaluate a boolean condition", "Trace an if/else branch", "Keep boundary conditions explicit"],
    introduction: "A program often needs to react differently to different inputs. Conditions turn a decision into a predictable branch in the control flow.",
    simpleExplanation: "A condition is a question with a true or false answer. If the answer is true, the first path runs; otherwise the program takes the alternative path.",
    technicalExplanation: "An `if` statement evaluates its test expression using the language's truthiness rules. Exactly one branch in an if/else pair executes. Comparisons should use strict equality when type coercion is not intended.",
    exampleCode: "const temperature = 18;\nif (temperature < 20) {\n  console.log(\"Wear a jacket\");\n} else {\n  console.log(\"A light layer is enough\");\n}",
    exampleNotes: "The `< 20` boundary is part of the requirement. Changing it to `<= 20` changes what happens at exactly 20 degrees.",
    commonMistakes: ["Using assignment inside a condition by accident", "Forgetting equality boundary cases", "Writing branches that cannot ever be reached"],
    applications: ["Validating form input", "Choosing a pricing tier", "Handling permissions and feature flags"],
    quiz: { question: "Which branch runs when `age` is 18 in `if (age >= 18)`?", options: ["The condition is false", "The condition is true", "Both branches", "Neither branch"], answer: 1, explanation: "18 is greater than or equal to 18, so the condition evaluates to true." },
  },
  {
    id: "loops-and-repetition",
    title: "Loops and repetition",
    category: "Programming fundamentals",
    level: "Beginner",
    summary: "Repeat work safely while a loop condition remains true.",
    objectives: ["Identify initialization, condition, and update", "Count loop iterations", "Avoid accidental infinite loops"],
    introduction: "Loops let one piece of code handle many values without copying the same instructions by hand.",
    simpleExplanation: "A loop is a repeated question: should we do the work again? A counter loop usually starts a counter, checks a limit, performs the body, and then changes the counter.",
    technicalExplanation: "A `for` loop contains initialization, a test evaluated before each iteration, and an update evaluated after the body. If the test never becomes false, execution does not terminate normally.",
    exampleCode: "let total = 0;\nfor (let i = 1; i <= 3; i += 1) {\n  total += i;\n}\nconsole.log(total); // 6",
    exampleNotes: "The body runs for i = 1, 2, and 3. The update then makes i equal 4, so `i <= 3` becomes false.",
    commonMistakes: ["Using `<` when the endpoint should be included", "Forgetting the counter update", "Changing the collection in a way that skips items"],
    applications: ["Rendering a list of records", "Summing measurements", "Retrying work with a bounded attempt count"],
    complexity: "A loop that visits n items once is usually O(n) time.",
    quiz: { question: "How many times does `for (let i = 0; i < 4; i++)` run?", options: ["3", "4", "5", "It never stops"], answer: 1, explanation: "The values are 0, 1, 2, and 3: four iterations." },
  },
];

export const lessonById = Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson])) as Record<string, Lesson>;

