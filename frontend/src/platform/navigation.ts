import type { LucideIcon } from "lucide-react";
import {
  Braces,
  Code2,
  Database,
  Home,
  Network,
  Newspaper,
  Search,
  Wrench,
} from "lucide-react";

export type PlatformModuleId =
  | "home"
  | "playground"
  | "algorithms"
  | "data-structures"
  | "compiler"
  | "sql-lab"
  | "tools"
  | "resources";

export interface PlatformNavItem {
  id: PlatformModuleId;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  group: "Workspace" | "Learn" | "Build" | "Resources";
}

export const platformNavigation: PlatformNavItem[] = [
  { id: "home", label: "Home", description: "Your AlgoLoom overview", href: "/home", icon: Home, group: "Workspace" },
  { id: "playground", label: "Playground", description: "Run and visualize code", href: "/playground", icon: Code2, group: "Workspace" },
  { id: "algorithms", label: "Algorithms", description: "Explore algorithmic thinking", href: "/algorithms", icon: Search, group: "Learn" },
  { id: "data-structures", label: "Data Structures", description: "Understand data organization", href: "/data-structures", icon: Network, group: "Learn" },
  { id: "compiler", label: "Compiler", description: "Learn how programs become runnable", href: "/compiler", icon: Braces, group: "Build" },
  { id: "sql-lab", label: "SQL Lab", description: "Practice query fundamentals", href: "/sql-lab", icon: Database, group: "Build" },
  { id: "tools", label: "Developer Tools", description: "Practical engineering utilities", href: "/tools", icon: Wrench, group: "Build" },
  { id: "resources", label: "Blog & Resources", description: "Guides and technical reading", href: "/resources", icon: Newspaper, group: "Resources" },
];

export const platformNavigationById = Object.fromEntries(
  platformNavigation.map((item) => [item.id, item]),
) as Record<PlatformModuleId, PlatformNavItem>;

