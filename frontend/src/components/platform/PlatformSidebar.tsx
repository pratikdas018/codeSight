import { Menu, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState } from "react";
import { CodeSightLogo } from "../CodeSightLogo";
import { platformNavigation } from "../../platform/navigation";

export const PlatformSidebar = () => {
  const [open, setOpen] = useState(false);
  const groups = Array.from(new Set(platformNavigation.map((item) => item.group)));

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close platform navigation" : "Open platform navigation"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="fixed left-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text)] shadow-lg lg:hidden"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open ? <button aria-label="Close navigation overlay" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" /> : null}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-[var(--cs-border)] bg-[var(--cs-background)]/95 px-4 py-5 backdrop-blur-xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-2 pb-7 pt-1"><CodeSightLogo compact /></div>
        <nav aria-label="AlgoLoom platform" className="flex-1 space-y-6 overflow-y-auto">
          {groups.map((group) => (
            <div key={group}>
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">{group}</div>
              <div className="space-y-1">
                {platformNavigation.filter((item) => item.group === group).map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.href}
                    end={item.id === "home" || item.id === "playground"}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${isActive ? "bg-[rgba(39,211,194,0.12)] text-[var(--cs-primary-bright)]" : "text-[var(--cs-text-muted)] hover:bg-[var(--cs-surface)] hover:text-[var(--cs-text)]"}`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0"><span className="block font-medium">{item.label}</span><span className="block truncate text-[11px] text-[var(--cs-text-subtle)]">{item.description}</span></span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-5 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3 text-xs text-[var(--cs-text-muted)]">
          <div className="font-medium text-[var(--cs-text)]">Keep exploring</div>
          <p className="mt-1 leading-5">Your existing workspaces and execution history remain available in Playground.</p>
        </div>
      </aside>
    </>
  );
};

