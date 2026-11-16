import { Menu, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { CodeSightLogo } from "../CodeSightLogo";
import { platformNavigation } from "../../platform/navigation";

export const PlatformSidebar = () => {
  const [open, setOpen] = useState(false);
  const groups = Array.from(new Set(platformNavigation.map((item) => item.group)));

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close platform navigation" : "Open platform navigation"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-50 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text)] shadow-lg lg:hidden"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open ? <button aria-label="Close navigation overlay" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" /> : null}
      <aside className={`group/sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden border-r border-white/10 bg-slate-900/75 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-md transition-[width,transform] duration-300 ease-in-out lg:w-16 lg:px-3 lg:py-5 lg:translate-x-0 lg:hover:w-64 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="shrink-0 px-0 pb-7 pt-1"><CodeSightLogo compact labelClassName="lg:opacity-0 lg:group-hover/sidebar:opacity-100 lg:transition-opacity lg:duration-200" /></div>
        <nav aria-label="AlgoLoom platform" className="platform-sidebar-scroll flex-1 space-y-6 overflow-y-auto">
          {groups.map((group) => (
            <div key={group}>
              <div className="mb-2 overflow-hidden whitespace-nowrap px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--cs-text-subtle)] lg:opacity-0 lg:transition-opacity lg:duration-200 lg:group-hover/sidebar:opacity-100">{group}</div>
              <div className="space-y-1">
                {platformNavigation.filter((item) => item.group === group).map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.href}
                    end={item.id === "home" || item.id === "playground"}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) => `group flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-xl px-3 py-3 text-sm transition ${isActive ? "bg-[rgba(39,211,194,0.12)] text-[var(--cs-primary-bright)]" : "text-[var(--cs-text-muted)] hover:bg-[var(--cs-surface)] hover:text-[var(--cs-text)]"}`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 overflow-hidden whitespace-nowrap lg:opacity-0 lg:transition-opacity lg:duration-200 lg:group-hover/sidebar:opacity-100"><span className="block font-medium">{item.label}</span><span className="block truncate text-[11px] text-[var(--cs-text-subtle)]">{item.description}</span></span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-5 overflow-hidden whitespace-nowrap rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3 text-xs text-[var(--cs-text-muted)] lg:opacity-0 lg:transition-opacity lg:duration-200 lg:group-hover/sidebar:opacity-100">
          <div className="font-medium text-[var(--cs-text)]">Keep exploring</div>
          <p className="mt-1 leading-5">Your existing workspaces and execution history remain available in Playground.</p>
        </div>
      </aside>
    </>
  );
};

