# Algorithm Visualization Implementation Matrix

## Audit and current status

| Area | Existing implementation | Current status | Reuse decision |
|---|---|---|---|
| Search trace engine | `visualizationEngine.ts` already generated deterministic linear and binary search frames | Working and extended | Preserve `AlgorithmStep` and extend the existing generator |
| Search explorer UI | `AlgorithmExplorerPage.tsx` provided input, target, timeline, playback, explanations and state inspection | Working and reused | No second visualizer or playback controller |
| Playback | `usePlayback.ts` controls play, pause, step, reset, speed and timeline position | Working | Reuse as the source of frame navigation |
| Linear search | Existing trace generation and tests | Working | Preserved |
| Binary search | Existing trace generation and tests | Working | Preserved; sorted working copy remains explicit |
| Jump search | Not previously present | Implemented in Stage B | Uses the shared deterministic search trace model |
| Interpolation search | Not previously present | Implemented in Stage B | Uses the shared deterministic search trace model |
| Exponential search | Not previously present | Implemented in Stage B | Uses the shared deterministic search trace model |
| Sorting algorithms | No reusable sorting trace family found during audit | Not implemented in this stage | Next Stage C |
| Graph/recursion/DP visualization | No complete reusable implementation found during audit | Not implemented in this stage | Later stages |
| Monaco/code-line mapping | Existing playground integration exists, but algorithm-specific source mapping is not yet connected | Partial | Extend only after trace families are stable |
| Learning integration | Learning service and progress foundation exist | Partial | Add meaningful algorithm milestones later; do not create a second progress system |
| Practice mode | Existing execution infrastructure is available | Not implemented for algorithms | Reuse the existing secure execution path in a later stage |

## Stage B trace contract

All five search algorithms now produce deterministic `AlgorithmStep` frames containing the
current operation, active indices, values, variables, and beginner/developer explanations.
Sorted-search algorithms operate on a sorted working copy, while linear search preserves the
input order. Empty input produces a safe terminal frame rather than throwing.

## Remaining implementation order

1. Sorting traces and algorithm metadata.
2. Reusable array visualization details and playback synchronization.
3. Pseudocode/source mapping.
4. Sorting comparison mode.
5. Graph, recursion and dynamic-programming visualizations.
6. Practice mode and learning-progress milestones.
