export const BRAND = {
  name: "AlgoLoom",
  legacyName: "CodeSight",
  tagline: "Understand code. Visualize logic. Build better software.",
  positioning: "Interactive programming education and developer productivity platform",
  descriptor: "Interactive Code Learning Platform",
  shortDescriptor: "Learn, visualize, and build better software.",
  colors: {
    background: "#0B0F14",
    surface: "#141A22",
    elevated: "#1B2430",
    primary: "#27D3C2",
    secondary: "#42B8E8",
    accent: "#9278F5",
    text: "#F3F6FA",
    textMuted: "#A2ADBC",
  },
} as const;

export type BrandTheme = "noctis" | "graphite" | "light";
