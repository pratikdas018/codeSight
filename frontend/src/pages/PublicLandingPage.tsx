import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Braces,
  Check,
  Code2,
  Database,
  GitBranch,
  Layers3,
  Network,
  Play,
  Search,
  Sparkles,
  TerminalSquare,
  Wrench,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { CodeSightLogo } from "../components/CodeSightLogo";
import { BRAND } from "../brand";
import { platformNavigation } from "../platform/navigation";
import type { SupportedLanguage } from "../utils/types";

type LinkCard = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
};

const popularVisualizations: LinkCard[] = [
  { title: "Algorithms", description: "Explore sorting, searching, greedy, graph, and dynamic-programming ideas.", href: "/algorithms", icon: BarChart3, accent: "text-emerald-300" },
  { title: "Data Structures", description: "Manipulate arrays, linked lists, trees, graphs, heaps, and hash maps.", href: "/data-structures", icon: Network, accent: "text-cyan-300" },
  { title: "Playground", description: "Step through code execution and inspect runtime state as it changes.", href: "/playground", icon: Code2, accent: "text-sky-300" },
  { title: "Developer Tools", description: "Use practical utilities for complexity, regular expressions, and bit operations.", href: "/tools", icon: Wrench, accent: "text-violet-300" },
];

const capabilities = [
  [Code2, "Interactive code execution", "Run supported languages in a workspace designed for understanding, not just output."],
  [Layers3, "Memory and execution state", "Follow variables, stack frames, heap objects, and the event flow behind your code."],
  [BarChart3, "Algorithm visualizations", "Watch comparisons, swaps, pointers, and decisions unfold step by step."],
  [Network, "Data structure exploration", "Build intuition by manipulating common structures and seeing their shape change."],
  [Database, "SQL learning workspace", "Practice query fundamentals with a dedicated SQL lab and result-focused workflow."],
  [TerminalSquare, "Developer productivity tools", "Keep complexity, regex, bitwise, and other everyday engineering helpers close by."],
] as const;

const languages: Array<{ id: SupportedLanguage; label: string; detail: string }> = [
  { id: "javascript", label: "JavaScript", detail: "Execution flow, async behavior, and runtime state." },
  { id: "python", label: "Python", detail: "Readable stepping for functions, loops, and data." },
  { id: "c", label: "C", detail: "Low-level control and memory-oriented learning." },
  { id: "cpp", label: "C++", detail: "Algorithms and systems concepts in a familiar workspace." },
  { id: "java", label: "Java", detail: "Object-oriented execution and structured problem solving." },
];

const exploreGroups = [
  { title: "Learn", links: platformNavigation.filter((item) => item.group === "Learn") },
  { title: "Build", links: platformNavigation.filter((item) => item.group === "Build") },
  { title: "Workspace", links: platformNavigation.filter((item) => item.group === "Workspace") },
  { title: "Resources", links: platformNavigation.filter((item) => item.group === "Resources") },
];

const PreviewCode = () => (
  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]/95 shadow-2xl shadow-cyan-950/30">
    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-[11px] text-slate-500">
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-400" /></span>
      <span className="font-mono">factorial.js</span>
      <span className="rounded-full bg-cyan-400/10 px-2 py-1 text-cyan-300">Step 04</span>
    </div>
    <div className="grid grid-cols-[2rem_1fr] px-4 py-4 font-mono text-[11px] leading-7 sm:text-xs sm:leading-8">
      <div className="select-none text-right text-slate-600">1<br />2<br />3<br />4<br />5<br />6</div>
      <div className="pl-4 text-slate-300">
        <div><span className="text-violet-300">function</span> <span className="text-sky-300">factorial</span>(n) &#123;</div>
        <div className="rounded-md bg-cyan-400/10 px-2 text-cyan-100"><span className="text-violet-300">if</span> (n &lt;= 1) <span className="text-violet-300">return</span> 1;</div>
        <div className="pl-4 text-slate-400">&#125;</div>
        <div><span className="text-violet-300">return</span> n * factorial(n - 1);</div>
        <div>&#125;</div>
        <div className="mt-2 text-slate-500">factorial(4)</div>
      </div>
    </div>
    <div className="grid gap-2 border-t border-white/10 bg-white/[0.025] p-4 sm:grid-cols-3">
      {["n = 2", "result = 2", "call stack: 3"].map((value) => <div key={value} className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 font-mono text-[11px] text-cyan-200">{value}</div>)}
    </div>
  </div>
);

const ProductPreview = () => (
  <div className="relative mx-auto w-full max-w-2xl">
    <div className="absolute -inset-8 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true" />
    <div className="relative rounded-3xl border border-cyan-300/20 bg-slate-900/75 p-3 shadow-[0_30px_100px_rgba(8,47,73,0.45)] backdrop-blur-xl sm:p-5">
      <div className="mb-3 flex items-center justify-between px-1 text-xs text-slate-400"><span>Interactive execution preview</span><span className="flex items-center gap-1.5 text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Ready</span></div>
      <PreviewCode />
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-white/10 bg-[#111827]/80 p-3"><div className="mb-3 flex items-center justify-between text-xs text-slate-400"><span>Execution flow</span><span className="text-cyan-300">4 / 6</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" /></div><div className="mt-3 flex gap-1.5">{["1", "2", "3", "4", "5"].map((step, index) => <span key={step} className={`grid h-7 w-7 place-items-center rounded-lg text-[10px] ${index < 4 ? "bg-cyan-400/15 text-cyan-200" : "bg-slate-800 text-slate-500"}`}>{step}</span>)}</div></div>
        <div className="rounded-xl border border-white/10 bg-[#111827]/80 p-3"><div className="mb-2 text-xs text-slate-400">Variables</div>{["n", "result", "frame"].map((key, index) => <div key={key} className="flex justify-between border-b border-white/5 py-1.5 font-mono text-[11px] last:border-0"><span className="text-slate-500">{key}</span><span className="text-emerald-300">{["2", "2", "factorial"][index]}</span></div>)}</div>
      </div>
    </div>
  </div>
);

export const PublicLandingPage = () => (
  <div className="min-h-screen overflow-x-clip bg-[#0b0f17] text-slate-100 selection:bg-cyan-300/30">
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0b0f17]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" aria-label="AlgoLoom home"><CodeSightLogo compact /></Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex" aria-label="Public navigation">
          <a href="#visualizations" className="transition-colors hover:text-white">Explore</a>
          <a href="#capabilities" className="transition-colors hover:text-white">Capabilities</a>
          <a href="#languages" className="transition-colors hover:text-white">Languages</a>
          <Link to="/algorithms" className="transition-colors hover:text-white">Algorithms</Link>
        </nav>
        <div className="flex items-center gap-2"><Link to="/?auth=1" className="hidden rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white sm:inline-flex">Sign in</Link><Link to="/playground" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cyan-300 px-3.5 py-2 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"><Play className="h-4 w-4" /> Start learning</Link></div>
      </div>
    </header>

    <main>
      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pb-28">
        <div className="absolute left-1/2 top-0 h-[34rem] w-[52rem] -translate-x-1/2 rounded-full bg-cyan-400/[0.07] blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-200"><Sparkles className="h-3.5 w-3.5" /> Interactive developer learning</div><h1 className="max-w-3xl text-4xl font-bold leading-[1.06] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">Understand code.<br /><span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">Visualize logic.</span><br />Build better software.</h1><p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">Explore execution, algorithms, and data structures through interactive visual learning built for developers who want to understand how software really works.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link to="/playground" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 font-semibold text-slate-950 transition-transform hover:-translate-y-0.5">Open Playground <ArrowRight className="h-4 w-4" /></Link><Link to="/algorithms" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 font-semibold text-white transition-colors hover:border-cyan-300/40 hover:bg-white/[0.06]">Explore Algorithms</Link></div><div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-300" /> Step-by-step execution</span><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-300" /> Real interactive tools</span></div></div>
          <ProductPreview />
        </div>
      </section>

      <section className="border-y border-white/5 bg-[#0e141e] px-4 py-20 sm:px-6 lg:px-8"><div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.75fr_1.25fr]"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">See the invisible</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Step through code. Understand every operation.</h2><p className="mt-4 leading-7 text-slate-400">Follow the current line, inspect values, and see execution state change in a way that makes difficult concepts concrete.</p><Link to="/playground" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">Explore code visualization <ArrowRight className="h-4 w-4" /></Link></div><ProductPreview /></div></section>

      <section id="visualizations" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Popular experiences</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Learn by seeing it happen.</h2></div><Link to="/algorithms" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">Browse all <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{popularVisualizations.map(({ title, description, href, icon: Icon, accent }) => <Link key={title} to={href} className="group rounded-2xl border border-white/10 bg-[#111827] p-5 transition-all hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-[#152033]"><Icon className={`h-6 w-6 ${accent}`} /><h3 className="mt-5 font-semibold text-white">{title}</h3><p className="mt-2 min-h-14 text-sm leading-6 text-slate-400">{description}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300">Open experience <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span></Link>)}</div></div></section>

      <section id="capabilities" className="scroll-mt-20 border-y border-white/5 bg-[#0e141e] px-4 py-20 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><div className="mx-auto max-w-2xl text-center"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">One focused platform</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything you need to understand code.</h2><p className="mt-4 text-slate-400">A connected set of learning and productivity surfaces for moving from “it works” to “I understand why.”</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{capabilities.map(([Icon, title, description]) => <div key={title} className="rounded-2xl border border-white/10 bg-[#111827]/80 p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300"><Icon className="h-5 w-5" /></div><h3 className="mt-4 font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p></div>)}</div></div></section>

      <section id="languages" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl text-center"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Built around your code</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Multiple languages. Deeper understanding.</h2><p className="mt-4 text-slate-400">Choose a familiar runtime and learn the concepts that transfer across every language.</p><div className="mt-8 grid gap-3 sm:grid-cols-5">{languages.map((language) => <div key={language.id} className="rounded-xl border border-white/10 bg-[#111827] p-4 text-left"><div className="font-semibold text-white">{language.label}</div><p className="mt-2 text-xs leading-5 text-slate-500">{language.detail}</p></div>)}</div></div></section>

      <section className="border-y border-white/5 bg-[#0e141e] px-4 py-20 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Explore AlgoLoom</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Follow your curiosity.</h2></div></div><div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{exploreGroups.map((group) => <div key={group.title}><h3 className="text-sm font-semibold text-white">{group.title}</h3><div className="mt-3 space-y-2">{group.links.map((item) => <Link key={item.id} to={item.href} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-cyan-200"><item.icon className="h-4 w-4 text-cyan-300/70" />{item.label}</Link>)}</div></div>)}</div></div></section>

      <section className="px-4 py-20 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/[0.12] via-slate-900 to-violet-400/[0.08] p-8 text-center sm:p-12"><Zap className="mx-auto h-7 w-7 text-cyan-300" /><h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">Your next programming breakthrough starts here.</h2><p className="mx-auto mt-4 max-w-xl text-slate-400">Stop memorizing code. Start understanding how it works.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/playground" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-300 px-5 font-semibold text-slate-950">Start learning</Link><Link to="/data-structures" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 font-semibold text-white">Explore data structures</Link></div></div></section>
    </main>

    <footer className="border-t border-white/5 bg-[#080b11] px-4 py-12 sm:px-6 lg:px-8"><div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]"><div><Link to="/"><CodeSightLogo compact /></Link><p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">{BRAND.positioning}. {BRAND.shortDescriptor}</p><a href="https://github.com/pratikdas018/codeSight" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><GitBranch className="h-4 w-4" /> GitHub</a></div>{exploreGroups.slice(0, 3).map((group) => <div key={group.title}><h3 className="text-sm font-semibold text-white">{group.title}</h3><div className="mt-3 space-y-2">{group.links.map((item) => <Link key={item.id} to={item.href} className="block text-sm text-slate-500 hover:text-cyan-200">{item.label}</Link>)}</div></div>)}</div><div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/5 pt-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} AlgoLoom. Learn by understanding.</span><span className="flex items-center gap-2"><Braces className="h-3.5 w-3.5" /> Built for curious developers</span></div></footer>
  </div>
);
