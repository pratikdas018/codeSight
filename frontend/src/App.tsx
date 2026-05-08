import { Suspense, lazy } from "react";

const HomePage = lazy(() =>
  import("./pages/HomePage").then((module) => ({
    default: module.HomePage,
  })),
);

const App = () => (
  <Suspense
    fallback={
      <main className="flex min-h-screen items-center justify-center bg-[#0b0e14] text-sm text-slate-300">
        Loading CodeSight...
      </main>
    }
  >
    <HomePage />
  </Suspense>
);

export default App;
