import type { BarVisualState } from "../../../types/algorithmVisualizer";

export const BarChartRenderer = ({ state }: { state: BarVisualState }) => {
  const maximum = Math.max(...state.values, 1);
  return <div className="flex h-72 items-end gap-1" role="list" aria-label="Animated algorithm bar chart">
    {state.values.map((value, index) => {
      const color = state.swapping.includes(index) ? "#EF4444" : state.comparing.includes(index) ? "#F59E0B" : state.accepted.includes(index) ? "#10B981" : "#2DD4BF";
      return <div key={`${index}-${value}`} role="listitem" title={`Index ${index}: ${value}`} className="min-w-0 flex-1 rounded-t-md transition-all duration-150 ease-out" style={{ height: `${Math.max(5, (value / maximum) * 92)}%`, backgroundColor: color, boxShadow: `0 0 0 1px ${color}55` }}><span className="sr-only">{value}</span></div>;
    })}
  </div>;
};
