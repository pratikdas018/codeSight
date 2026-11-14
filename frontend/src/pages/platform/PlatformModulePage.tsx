import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { platformNavigationById, type PlatformModuleId } from "../../platform/navigation";

export const PlatformModulePage = ({ moduleId }: { moduleId: Exclude<PlatformModuleId, "playground"> }) => {
  const module = platformNavigationById[moduleId];
  const isHome = moduleId === "home";
  return (
    <div className="space-y-8">
      <section className="max-w-3xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[rgba(39,211,194,0.2)] bg-[rgba(39,211,194,0.08)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--cs-primary-bright)]"><module.icon className="h-3.5 w-3.5" /> {module.label}</div>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--cs-text)] sm:text-5xl">{isHome ? "A clearer path from code to understanding." : module.label}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--cs-text-muted)]">{isHome ? "AlgoLoom brings learning, execution, visualization, and developer tools into one workspace." : module.description}</p>
      </section>
      {isHome ? <HomeOverview /> : <ModuleFoundation module={module} />}
    </div>
  );
};

const HomeOverview = () => (
  <div className="grid gap-5 md:grid-cols-2">
    <Link to="/playground" className="group rounded-2xl border border-[rgba(39,211,194,0.25)] bg-[var(--cs-surface)] p-6 transition hover:border-[var(--cs-primary)]">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cs-primary-bright)]">Continue building</div>
      <h2 className="mt-3 text-xl font-semibold text-[var(--cs-text)]">Open your Playground</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--cs-text-muted)]">Use the existing editor, runtimes, execution trace, timeline, and memory visualizations.</p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--cs-text)]">Open Playground <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
    </Link>
    <div className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Platform foundation</div>
      <h2 className="mt-3 text-xl font-semibold text-[var(--cs-text)]">One coherent learning workspace</h2>
      <ul className="mt-4 space-y-3 text-sm text-[var(--cs-text-muted)]">
        {["Shared navigation and responsive shell", "Existing workspaces remain in Playground", "New modules can add content without duplicating execution"].map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-primary)]" />{item}</li>)}
      </ul>
    </div>
  </div>
);

const ModuleFoundation = ({ module }: { module: (typeof platformNavigationById)[PlatformModuleId] }) => (
  <section className="max-w-2xl rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-7">
    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Module foundation ready</div>
    <h2 className="mt-3 text-xl font-semibold text-[var(--cs-text)]">{module.label} is part of the AlgoLoom platform map.</h2>
    <p className="mt-3 text-sm leading-6 text-[var(--cs-text-muted)]">This module is intentionally a clear, honest entry point while its content and domain workflows are designed in a later implementation stage. No placeholder execution or fake learning actions are exposed here.</p>
    <Link to="/playground" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--cs-primary)] px-4 py-2.5 text-sm font-semibold text-[#061114] transition hover:brightness-110">Use Playground <ArrowRight className="h-4 w-4" /></Link>
  </section>
);

