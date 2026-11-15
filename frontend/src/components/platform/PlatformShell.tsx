import { ChevronRight } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { CodeSightLogo } from "../CodeSightLogo";
import { platformNavigationById, type PlatformModuleId } from "../../platform/navigation";
import { PlatformSidebar } from "./PlatformSidebar";

export const PlatformShell = () => {
  const location = useLocation();
  const current = Object.values(platformNavigationById).find((item) => item.href === location.pathname);

  return (
    <div className="min-h-screen bg-[var(--cs-background)] text-[var(--cs-text)] lg:flex">
      <PlatformSidebar />
      <div className="min-w-0 flex-1 lg:ml-16">
        <header className="border-b border-[var(--cs-border)] bg-[var(--cs-background)]/80 px-5 pb-5 pt-20 backdrop-blur-xl sm:px-8 lg:px-10 lg:pt-7">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="lg:hidden"><CodeSightLogo compact iconOnly /></div>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[var(--cs-text-subtle)]">
              <Link to="/home" className="transition hover:text-[var(--cs-text)]">AlgoLoom</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-[var(--cs-text-muted)]">{current?.label ?? "Platform"}</span>
            </nav>
            <Link to="/playground" className="rounded-lg border border-[var(--cs-border)] px-3 py-2 text-xs font-medium text-[var(--cs-text-muted)] transition hover:border-[var(--cs-primary)] hover:text-[var(--cs-text)]">Open Playground</Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10"><Outlet /></main>
      </div>
    </div>
  );
};

export const platformModuleIds: PlatformModuleId[] = ["home", "algorithms", "data-structures", "compiler", "sql-lab", "tools", "resources"];

