# Data Structure Explorer Implementation Matrix

| Structure | Existing state before this stage | Current status | Notes |
|---|---|---|---|
| Array | No typed operation engine | Implemented | Access, insert, delete, update, search with deterministic traces |
| Dynamic Array | No implementation | Implemented | Uses the same safe operation model; dynamic-array identity is preserved for future capacity modeling |
| Stack | Working page-level push/pop/peek/clear snapshots | Preserved and reused | Existing behavior remains available; extraction into the shared typed command model is a later stage |
| Queue | Working page-level enqueue/dequeue/peek/clear snapshots | Preserved and reused | Existing behavior remains available; extraction into the shared typed command model is a later stage |
| Linked lists | Not found as a complete interactive implementation | Missing | Stage C |
| Trees and heaps | Not found as a complete interactive implementation | Missing | Stages E–F |
| Graphs | Algorithm-side support is not yet a complete structure editor | Missing | Stage G |
| Hash tables | Not found as a complete interactive implementation | Missing | Stage H |
| Advanced structures | Not found as a complete interactive implementation | Missing | Stage I |

## Shared architecture used in Stage B

- `ArrayOperation` is a discriminated union for safe operation commands.
- `generateArrayTrace` is pure and deterministic; it does not depend on React.
- `DataStructureTraceStep` extends the existing data-structure snapshot abstraction with active indices, variables, and operation statistics.
- `DataStructureExplorerPage` reuses the existing `usePlayback` hook for array timeline navigation.
- Invalid operations produce an explicit non-mutating error frame.

No new dependency, database table, API endpoint, or execution service was added.
