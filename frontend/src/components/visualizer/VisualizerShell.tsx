import { useMemo, useState } from "react";
import { BarChart3, ChevronDown, Play, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { algorithmRegistry } from "../../registry/algorithmRegistry";
import { useVisualizerPlayer } from "../../hooks/useVisualizerPlayer";
import type { VisualizerCategoryId } from "../../types/algorithmVisualizer";
import { BarChartRenderer } from "./renderers/BarChartRenderer";
import { TimelineRenderer } from "./renderers/TimelineRenderer";

const randomValues = (size: number) => Array.from({ length: size }, () => Math.floor(Math.random() * 90) + 10);

export const VisualizerShell = ({ initialCategory = "sorting" }: { initialCategory?: VisualizerCategoryId }) => {
  const navigate = useNavigate();
  const [categoryId, setCategoryId] = useState<VisualizerCategoryId>(initialCategory);
  const [algorithmId, setAlgorithmId] = useState("selection-sort");
  const [values, setValues] = useState(() => randomValues(30));
  const [size, setSize] = useState(30);
  const category = algorithmRegistry.find((item) => item.id === categoryId) ?? algorithmRegistry[0];
  const CategoryIcon = category.icon;
  const algorithm = category.algorithms.find((item) => item.id === algorithmId) ?? category.algorithms[0];
  const steps = useMemo(() => algorithm ? algorithm.generateSteps(algorithm.categoryId === "sorting" ? values : undefined) : [], [algorithm, values]);
  const player = useVisualizerPlayer(steps);
  const current = steps[player.currentStepIndex];
  const changeCategory = () => {
    const index = algorithmRegistry.findIndex((item) => item.id === category.id);
    const next = algorithmRegistry[(index + 1) % algorithmRegistry.length];
    setCategoryId(next.id);
    setAlgorithmId(next.algorithms[0]?.id ?? "");
  };
  const selectAlgorithm = (id: string) => { player.pause(); setAlgorithmId(id); };
  const regenerate = (nextSize = size) => { player.reset(); setValues(randomValues(nextSize)); };
  const tryExample = () => {
    player.reset();
    if (algorithm?.categoryId === "sorting") setValues(algorithm.createExample() as number[]);
  };
  const updateSize = (nextSize: number) => { setSize(nextSize); regenerate(nextSize); };
  const canRender = current?.visualState.kind === "bars" || current?.visualState.kind === "timeline";

  return <div className="space-y-6 text-slate-100">
    <header>
      <div className="flex items-center gap-3"><span className="rounded-lg bg-[#0F292E] p-2.5 text-[#2DD4BF]"><BarChart3 className="h-6 w-6" /></span><h1 className="text-2xl font-bold">Algorithm Visualizations</h1></div>
      <p className="mt-3 text-sm text-[#94A3B8]">Watch algorithms in action with real-time animations. Adjust speed, change inputs, and compare different approaches.</p>
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" className="rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-bold text-[#0B0F17]">Visualize this algorithm</button><button type="button" onClick={tryExample} className="rounded-lg border border-[#1E293B] bg-[#111827] px-4 py-2 text-sm text-[#E2E8F0]">Try this example</button><button type="button" onClick={() => navigate("/playground")} className="rounded-lg border border-[#1E293B] bg-[#111827] px-4 py-2 text-sm text-[#E2E8F0]">Run in playground</button></div>
    </header>

    <section className="rounded-xl border border-[#1E293B] bg-[#111827] p-4"><div className="flex items-center justify-between gap-4"><button type="button" onClick={changeCategory} className="flex min-w-0 items-center gap-3 text-left"><span className="rounded-lg bg-[#0F292E] p-2.5 text-[#2DD4BF]"><CategoryIcon className="h-5 w-5" /></span><span><span className="block font-semibold text-white">{category.title}</span><span className="block text-xs text-[#64748B]">{category.description}</span></span></button><button type="button" onClick={changeCategory} className="rounded-md p-2 text-slate-400 hover:bg-slate-800" aria-label="Change algorithm category"><ChevronDown className="h-5 w-5" /></button></div></section>

    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{category.algorithms.map((item) => <button key={item.id} type="button" onClick={() => selectAlgorithm(item.id)} className={`rounded-lg border px-3 py-2 text-sm transition-colors ${algorithm?.id === item.id ? "border-[#10B981] bg-[#064E3B]/40 text-[#34D399]" : "border-[#1E293B] bg-[#111827] text-[#94A3B8] hover:border-[#334155]"}`}>{item.title}</button>)}<button type="button" onClick={player.toggle} disabled={!steps.length} className="inline-flex items-center gap-2 rounded-lg border border-[#10B981] bg-[#064E3B]/60 px-4 py-2 text-sm text-[#34D399] hover:bg-[#065F46] disabled:opacity-40"><Play className="h-4 w-4" />{player.isPlaying ? "Pause" : "Animate"}</button></div><div className="flex flex-wrap items-center gap-3"><label className="text-xs text-slate-400">Speed <input aria-label="Animation speed" type="range" min="1" max="100" value={player.speed} onChange={(event) => player.setSpeed(Number(event.target.value))} className="ml-2 w-20 accent-[#2DD4BF]" /></label>{category.id === "sorting" && <label className="text-xs text-slate-400">Size <input aria-label="Array size" type="range" min="10" max="100" value={size} onChange={(event) => updateSize(Number(event.target.value))} className="ml-2 w-20 accent-[#2DD4BF]" /></label>}<button type="button" onClick={player.reset} className="inline-flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-2 text-sm text-[#94A3B8]"><RotateCcw className="h-4 w-4" />Reset</button></div></div>

    {current && <><div className="rounded-lg border border-[#10B981]/40 bg-[#052E2B]/50 px-4 py-2.5 font-mono text-sm text-[#34D399]">{current.summaryBannerText}</div><div className="rounded-lg border border-[#3B82F6]/40 bg-[#0C1E35]/70 px-4 py-2.5 font-mono text-sm text-[#60A5FA]">{current.stepDetailText}</div></>}
    <section className="min-h-[380px] rounded-xl border border-[#1E293B] bg-[#0F1522] p-6"><p className="mb-6 text-sm font-medium text-[#E2E8F0]">{algorithm ? algorithm.description : "Select a category to explore its algorithms."}</p>{canRender && current.visualState.kind === "bars" && <BarChartRenderer state={current.visualState} />}{canRender && current.visualState.kind === "timeline" && <TimelineRenderer state={current.visualState} />}{!current && <div className="flex min-h-[280px] items-center justify-center text-sm text-slate-500">No visualizer is registered for this category yet.</div>}</section>
    {steps.length > 0 && <div className="flex items-center gap-3"><button type="button" onClick={player.previous} disabled={player.currentStepIndex === 0} className="rounded-lg border border-[#1E293B] px-3 py-2 text-sm disabled:opacity-40">Previous</button><button type="button" onClick={player.next} disabled={player.currentStepIndex >= steps.length - 1} className="rounded-lg border border-[#1E293B] px-3 py-2 text-sm disabled:opacity-40">Next</button><input type="range" min="0" max={steps.length - 1} value={player.currentStepIndex} onChange={(event) => player.setCurrentStepIndex(Number(event.target.value))} className="flex-1 accent-[#2DD4BF]" aria-label="Visualizer timeline" /><span className="font-mono text-xs text-slate-500">{player.currentStepIndex + 1}/{steps.length}</span></div>}
    {algorithm && <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-4 text-sm text-slate-400"><span className="font-semibold text-white">{algorithm.title}</span><span className="ml-4 font-mono text-[#2DD4BF]">{algorithm.complexity}</span></div>}
  </div>;
};
