import { useMemo, useState } from "react";
import {
  Binary,
  Braces,
  Check,
  Cpu,
  Gauge,
  LineChart,
  Regex,
  RotateCcw,
  Wrench,
} from "lucide-react";

type ToolId = "big-o" | "regex" | "bits" | "complexity";
type ComplexityId = "constant" | "logarithmic" | "linear" | "linearithmic" | "quadratic" | "cubic" | "exponential";

const tools: Array<{ id: ToolId; label: string; description: string; icon: typeof LineChart }> = [
  { id: "big-o", label: "Big-O Chart", description: "Compare algorithm growth rates interactively.", icon: LineChart },
  { id: "regex", label: "Regex Playground", description: "Test patterns and inspect matches safely.", icon: Regex },
  { id: "bits", label: "Bit Manipulation", description: "Visualize binary operations step by step.", icon: Binary },
  { id: "complexity", label: "Complexity Analyzer", description: "Get a transparent heuristic from code patterns.", icon: Cpu },
];

const complexities: Array<{ id: ComplexityId; label: string; color: string; formula: (n: number) => number; note: string }> = [
  { id: "constant", label: "O(1)", color: "#27d3c2", formula: () => 1, note: "Hash lookup, array access" },
  { id: "logarithmic", label: "O(log n)", color: "#42b8e8", formula: (n) => Math.log2(n), note: "Binary search, balanced tree operations" },
  { id: "linear", label: "O(n)", color: "#9278f5", formula: (n) => n, note: "Traversal, linear search" },
  { id: "linearithmic", label: "O(n log n)", color: "#f2c14e", formula: (n) => n * Math.log2(n), note: "Merge sort, heap sort" },
  { id: "quadratic", label: "O(n²)", color: "#ee8b2f", formula: (n) => n ** 2, note: "Bubble sort, nested loops" },
  { id: "cubic", label: "O(n³)", color: "#ff4d5f", formula: (n) => n ** 3, note: "Three nested loops" },
  { id: "exponential", label: "O(2ⁿ)", color: "#ff3f72", formula: (n) => 2 ** n, note: "Naive recursive branching" },
];

const regexPresets: Record<string, { pattern: string; flags: string; sample: string }> = {
  Email: { pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+", flags: "gi", sample: "Email us at hello@algoloom.dev or team@example.com" },
  URL: { pattern: "https?://[^\\s]+", flags: "gi", sample: "Visit https://algoloom.dev/docs and https://example.com" },
  Phone: { pattern: "\\+?[0-9][0-9\\s().-]{7,}", flags: "g", sample: "Call +1 (555) 123-4567 or 555 555 0100" },
  "Hex Color": { pattern: "#[0-9a-fA-F]{3,8}\\b", flags: "g", sample: "Brand colors: #27D3C2, #9278F5, #fff" },
  "IP Address": { pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b", flags: "g", sample: "Servers: 127.0.0.1 and 192.168.1.10" },
  Date: { pattern: "\\b\\d{4}-\\d{2}-\\d{2}\\b", flags: "g", sample: "Releases: 2026-11-15 and 2027-01-01" },
};

const complexitySamples: Record<string, string> = {
  "Two Sum": "function twoSum(values, target) {\n  for (let i = 0; i < values.length; i++) {\n    for (let j = i + 1; j < values.length; j++) {\n      if (values[i] + values[j] === target) return [i, j];\n    }\n  }\n  return [];\n}",
  "Bubble Sort": "function bubbleSort(values) {\n  for (let i = 0; i < values.length; i++) {\n    for (let j = 0; j < values.length - i - 1; j++) {\n      if (values[j] > values[j + 1]) [values[j], values[j + 1]] = [values[j + 1], values[j]];\n    }\n  }\n  return values;\n}",
  "Binary Search": "function binarySearch(values, target) {\n  let left = 0, right = values.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (values[mid] === target) return mid;\n    if (values[mid] < target) left = mid + 1; else right = mid - 1;\n  }\n  return -1;\n}",
  "Fibonacci (Recursive)": "function fibonacci(n) {\n  if (n < 2) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}",
  "Merge Sort": "function mergeSort(values) {\n  if (values.length < 2) return values;\n  const mid = Math.floor(values.length / 2);\n  return merge(mergeSort(values.slice(0, mid)), mergeSort(values.slice(mid)));\n}",
};

const cardClass = "rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)]";

export const DeveloperToolsPage = () => {
  const [activeTool, setActiveTool] = useState<ToolId>("big-o");
  return (
    <div className="space-y-7 pb-10">
      <header>
        <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cs-primary-bright)]"><Wrench className="h-4 w-4" /> Build & improve</div>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--cs-text)] sm:text-5xl">Developer Productivity Tools</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--cs-text-muted)]">Interactive utilities for understanding complexity, regular expressions, bitwise operations, and code performance.</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const selected = activeTool === tool.id;
          return <button key={tool.id} onClick={() => setActiveTool(tool.id)} className={`text-left ${cardClass} p-4 transition ${selected ? "border-[var(--cs-primary)] bg-[rgba(39,211,194,0.08)]" : "hover:border-[var(--cs-primary)]"}`}><div className="flex items-start gap-3"><span className="rounded-lg bg-[rgba(39,211,194,0.12)] p-2 text-[var(--cs-primary)]"><Icon className="h-5 w-5" /></span><span><span className="block font-semibold text-[var(--cs-text)]">{tool.label}</span><span className="mt-1 block text-xs leading-5 text-[var(--cs-text-muted)]">{tool.description}</span></span></div></button>;
        })}
      </div>
      {activeTool === "big-o" && <BigOChart />}
      {activeTool === "regex" && <RegexPlayground />}
      {activeTool === "bits" && <BitManipulation />}
      {activeTool === "complexity" && <ComplexityAnalyzer />}
    </div>
  );
};

const BigOChart = () => {
  const [selected, setSelected] = useState<ComplexityId[]>(["constant", "logarithmic", "linear", "linearithmic", "quadratic", "exponential"]);
  const [maxN, setMaxN] = useState(32);
  const points = useMemo(() => complexities.filter((item) => selected.includes(item.id)).map((item) => ({ ...item, points: Array.from({ length: maxN }, (_, index) => item.formula(index + 1)) })), [maxN, selected]);
  const maxValue = Math.max(...points.flatMap((item) => item.points), 1);
  return <section className="space-y-5"><div className="flex flex-wrap gap-2">{complexities.map((item) => <button key={item.id} onClick={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selected.includes(item.id) ? "border-transparent text-[#061114]" : "border-[var(--cs-border)] text-[var(--cs-text-muted)]"}`} style={selected.includes(item.id) ? { backgroundColor: item.color } : undefined}>{item.label}</button>)}<label className="ml-auto flex items-center gap-2 text-xs text-[var(--cs-text-muted)]">Max n<select value={maxN} onChange={(event) => setMaxN(Number(event.target.value))} className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-elevated)] px-2 py-1.5 text-[var(--cs-text)]"><option value={16}>16</option><option value={32}>32</option><option value={64}>64</option></select></label></div><div className="grid gap-5 xl:grid-cols-[1fr_300px]"><div className={`${cardClass} p-4`}><div className="mb-3 flex items-center justify-between text-xs text-[var(--cs-text-subtle)]"><span>Relative growth (normalized)</span><span>input size →</span></div><svg viewBox="0 0 800 380" className="h-[360px] w-full" role="img" aria-label="Big O complexity comparison chart"><path d="M50 20V335H780" fill="none" stroke="rgba(162,173,188,.25)" /><path d="M50 100H780M50 180H780M50 260H780" stroke="rgba(162,173,188,.1)" strokeDasharray="4 6" />{points.map((item) => <polyline key={item.id} fill="none" stroke={item.color} strokeWidth="3" points={item.points.map((value, index) => `${50 + (index / Math.max(maxN - 1, 1)) * 730},${335 - (Math.min(value / maxValue, 1) * 300)}`).join(" ")} />)}</svg></div><div className="space-y-2">{complexities.map((item) => <div key={item.id} className={`${cardClass} p-4 opacity-${selected.includes(item.id) ? "100" : "50"}`}><div className="flex items-center justify-between"><span className="font-semibold" style={{ color: item.color }}>{item.label}</span><span className="text-xs text-[var(--cs-text-subtle)]">{item.id === "constant" ? "Constant" : item.id}</span></div><p className="mt-2 text-xs text-[var(--cs-text-muted)]">{item.note}</p></div>)}</div></div><p className="text-xs text-[var(--cs-text-subtle)]">The curves are normalized for visual comparison. They illustrate theoretical growth, not benchmark timings on your machine.</p></section>;
};

const RegexPlayground = () => {
  const [pattern, setPattern] = useState(regexPresets.Email.pattern);
  const [flags, setFlags] = useState("gi");
  const [sample, setSample] = useState(regexPresets.Email.sample);
  const result = useMemo(() => { try { const safeFlags = Array.from(new Set(flags.replace(/[^dgimsuvy]/g, "").split(""))).join(""); const regex = new RegExp(pattern, safeFlags.includes("g") ? safeFlags : `${safeFlags}g`); const matches = Array.from(sample.matchAll(regex)); const fragments: Array<{ text: string; match: boolean }> = []; let cursor = 0; matches.forEach((match) => { const start = match.index ?? 0; if (start > cursor) fragments.push({ text: sample.slice(cursor, start), match: false }); fragments.push({ text: match[0], match: true }); cursor = start + match[0].length; }); if (cursor < sample.length) fragments.push({ text: sample.slice(cursor), match: false }); return { matches, fragments, error: "" }; } catch (error) { return { matches: [], fragments: [{ text: sample, match: false }], error: error instanceof Error ? error.message : "Invalid regular expression" }; } }, [flags, pattern, sample]);
  return <section className="space-y-5"><div className="flex flex-wrap gap-2">{Object.entries(regexPresets).map(([name, preset]) => <button key={name} onClick={() => { setPattern(preset.pattern); setFlags(preset.flags); setSample(preset.sample); }} className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-elevated)] px-3 py-2 text-xs text-[var(--cs-text-muted)] hover:border-[var(--cs-primary)]">{name}</button>)}</div><div className={`${cardClass} space-y-4 p-5`}><label className="block text-sm font-medium text-[var(--cs-text)]">Regular expression<input value={pattern} onChange={(event) => setPattern(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-elevated)] px-3 py-3 font-mono text-sm text-[var(--cs-primary)] outline-none focus:border-[var(--cs-primary)]" /></label><div className="flex flex-wrap gap-2">{["g", "i", "m", "s"].map((flag) => <button key={flag} onClick={() => setFlags((current) => current.includes(flag) ? current.replace(flag, "") : `${current}${flag}`)} className={`rounded-lg border px-3 py-1.5 font-mono text-xs ${flags.includes(flag) ? "border-[var(--cs-primary)] text-[var(--cs-primary)]" : "border-[var(--cs-border)] text-[var(--cs-text-muted)]"}`}>{flag}</button>)}</div><label className="block text-sm font-medium text-[var(--cs-text)]">Test string<textarea value={sample} onChange={(event) => setSample(event.target.value)} rows={4} className="mt-2 w-full resize-y rounded-lg border border-[var(--cs-border)] bg-[var(--cs-elevated)] px-3 py-3 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-primary)]" /></label>{result.error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{result.error}</p> : <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-elevated)] p-4"><div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--cs-text-subtle)]">{result.matches.length} match{result.matches.length === 1 ? "" : "es"} found</div><p className="whitespace-pre-wrap break-words font-mono text-sm leading-7 text-[var(--cs-text)]">{result.fragments.map((fragment, index) => fragment.match ? <mark key={index} className="rounded bg-[rgba(39,211,194,.25)] px-1 text-[var(--cs-primary-bright)]">{fragment.text}</mark> : <span key={index}>{fragment.text}</span>)}</p></div>}</div></section>;
};

const BitManipulation = () => {
  const [value, setValue] = useState(42);
  const [operand, setOperand] = useState(1);
  const [operation, setOperation] = useState("left");
  const result = operation === "and" ? value & operand : operation === "or" ? value | operand : operation === "xor" ? value ^ operand : operation === "not" ? ~value : operation === "right" ? value >> operand : value << operand;
  const bits = (number: number) => (number >>> 0).toString(2).slice(-8).padStart(8, "0").split("");
  return <section className="space-y-5"><div className="flex flex-wrap gap-2">{[["and", "AND &"], ["or", "OR |"], ["xor", "XOR ^"], ["not", "NOT ~"], ["left", "Left Shift <<"], ["right", "Right Shift >>"]].map(([id, label]) => <button key={id} onClick={() => setOperation(id)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${operation === id ? "border-[var(--cs-primary)] bg-[rgba(39,211,194,.1)] text-[var(--cs-primary)]" : "border-[var(--cs-border)] text-[var(--cs-text-muted)]"}`}>{label}</button>)}</div><div className="grid gap-5 xl:grid-cols-[1fr_300px]"><div className={`${cardClass} p-6`}><div className="flex flex-wrap gap-3"><label className="text-sm text-[var(--cs-text-muted)]">Value<input type="number" value={value} onChange={(event) => setValue(Number(event.target.value) || 0)} className="mt-2 block w-28 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-elevated)] px-3 py-2 text-[var(--cs-text)]" /></label>{operation !== "not" && <label className="text-sm text-[var(--cs-text-muted)]">{operation.includes("shift") || operation === "left" || operation === "right" ? "Positions" : "Operand"}<input type="number" min={0} value={operand} onChange={(event) => setOperand(Math.max(0, Number(event.target.value) || 0))} className="mt-2 block w-28 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-elevated)] px-3 py-2 text-[var(--cs-text)]" /></label>}</div><BitRow label="Input" value={value} /><BitRow label="Result" value={result} result /><div className="mt-5 rounded-lg bg-[rgba(39,211,194,.08)] p-4 text-center font-mono text-sm text-[var(--cs-primary-bright)]">{value} {operation === "and" ? "&" : operation === "or" ? "|" : operation === "xor" ? "^" : operation === "not" ? "~" : operation === "left" ? "<<" : ">>"} {operation === "not" ? "" : operand} = {result}</div></div><div className={`${cardClass} p-5`}><h2 className="font-semibold text-[var(--cs-text)]">Bit tricks</h2><div className="mt-4 space-y-3 text-sm text-[var(--cs-text-muted)]"><p><strong className="text-[var(--cs-primary)]">Power of 2:</strong> n &amp; (n - 1) = 0 → {value > 0 && (value & (value - 1)) === 0 ? "true" : "false"}</p><p><strong className="text-[var(--cs-primary)]">Even:</strong> n &amp; 1 = 0 → {value % 2 === 0 ? "even" : "odd"}</p><p><strong className="text-[var(--cs-primary)]">Toggle bit k:</strong> n ^ (1 &lt;&lt; k)</p><p><strong className="text-[var(--cs-primary)]">Set bit k:</strong> n | (1 &lt;&lt; k)</p><p><strong className="text-[var(--cs-primary)]">Clear bit k:</strong> n &amp; ~(1 &lt;&lt; k)</p></div></div></div></section>;
};

const BitRow = ({ label, value, result = false }: { label: string; value: number; result?: boolean }) => <div className="mt-7"><div className="mb-2 flex items-center justify-between text-xs text-[var(--cs-text-subtle)]"><span>{label}</span><span className={result ? "text-[var(--cs-primary)]" : ""}>{value}</span></div><div className="flex gap-2">{(value >>> 0).toString(2).slice(-8).padStart(8, "0").split("").map((bit, index) => <span key={index} className={`flex h-10 w-10 items-center justify-center rounded-lg border font-mono ${bit === "1" ? "border-[var(--cs-primary)] bg-[rgba(39,211,194,.15)] text-[var(--cs-primary)]" : "border-[var(--cs-border)] bg-[var(--cs-elevated)] text-[var(--cs-text-muted)]"}`}>{bit}</span>)}</div></div>;

const analyzeCode = (code: string) => { const nested = (code.match(/for\s*\([^)]*\)[\s\S]*for\s*\(/g) ?? []).length > 0; const recursion = /\b(\w+)\s*\([^;{}]*\)[\s\S]*\b\1\s*\(/.test(code); const binary = /mid|Math\.floor\s*\([^)]*\/\s*2|left\s*[+<]|right\s*[-/>]/.test(code); const sort = /mergeSort|\.sort\s*\(|merge\s*\(/.test(code); if (recursion && /fibonacci/i.test(code)) return { time: "O(2ⁿ)", space: "O(n)", detail: "Recursive branching repeats overlapping subproblems." }; if (binary) return { time: "O(log n)", space: "O(1)", detail: "The search interval is reduced by roughly half each iteration." }; if (sort) return { time: "O(n log n)", space: "O(n)", detail: "The input is divided into logarithmic levels and merged or sorted." }; if (nested) return { time: "O(n²)", space: "O(1)", detail: "Two dependent loops can visit a quadratic number of pairs." }; if (recursion) return { time: "O(n)", space: "O(n)", detail: "A recursive call chain grows with the input size." }; return { time: "O(n)", space: "O(1)", detail: "A linear scan or single loop pattern was detected." }; };

const ComplexityAnalyzer = () => { const [sample, setSample] = useState("Binary Search"); const [code, setCode] = useState(complexitySamples["Binary Search"]); const analysis = useMemo(() => analyzeCode(code), [code]); return <section className="space-y-5"><div className="flex flex-wrap gap-2">{Object.keys(complexitySamples).map((name) => <button key={name} onClick={() => { setSample(name); setCode(complexitySamples[name]); }} className={`rounded-lg border px-3 py-2 text-xs ${sample === name ? "border-[var(--cs-primary)] text-[var(--cs-primary)]" : "border-[var(--cs-border)] text-[var(--cs-text-muted)]"}`}>{name}</button>)}</div><div className="grid gap-5 xl:grid-cols-[1fr_320px]"><div className={`${cardClass} overflow-hidden`}><div className="flex items-center justify-between border-b border-[var(--cs-border)] px-5 py-4"><h2 className="font-semibold text-[var(--cs-text)]">Code input</h2><span className="text-xs text-[var(--cs-text-subtle)]">{code.split("\n").length} lines</span></div><textarea value={code} onChange={(event) => { setSample(""); setCode(event.target.value); }} spellCheck={false} className="min-h-[360px] w-full resize-y bg-[var(--cs-elevated)] p-5 font-mono text-sm leading-7 text-[var(--cs-text)] outline-none" /></div><div className="space-y-4"><div className={`${cardClass} p-5`}><div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--cs-text-subtle)]"><Gauge className="h-4 w-4" /> Estimated complexity</div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><div className="rounded-lg bg-[var(--cs-elevated)] p-4"><span className="text-xs text-[var(--cs-text-subtle)]">Time</span><strong className="mt-2 block text-2xl text-[var(--cs-primary)]">{analysis.time}</strong></div><div className="rounded-lg bg-[var(--cs-elevated)] p-4"><span className="text-xs text-[var(--cs-text-subtle)]">Space</span><strong className="mt-2 block text-2xl text-[var(--cs-secondary)]">{analysis.space}</strong></div></div></div><div className={`${cardClass} p-5`}><h2 className="font-semibold text-[var(--cs-text)]">Analysis details</h2><p className="mt-3 text-sm leading-6 text-[var(--cs-text-muted)]">{analysis.detail}</p><p className="mt-4 text-xs text-[var(--cs-text-subtle)]">This is a pattern-based estimate for learning. It is not a compiler or a benchmark.</p></div></div></div></section>; };

