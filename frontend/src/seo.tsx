import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { BRAND } from "./brand";

const PRODUCTION_SITE_URL = "https://algoloom-code.vercel.app";
const DEFAULT_TITLE = `${BRAND.name} — Interactive Code Learning Platform`;
const DEFAULT_DESCRIPTION =
  `${BRAND.tagline} Learn programming, visualize execution step by step, and inspect variables, stack, and heap memory.`;
const GOOGLE_SITE_VERIFICATION = "o_AbIaACjH--EyMxEREqo1zk4zEGUt82Ade_879VUIs";

const normalizeSiteUrl = (value: string | undefined) => {
  const candidate = value?.trim();
  if (!candidate || !/^https?:\/\//i.test(candidate)) return PRODUCTION_SITE_URL;
  return candidate.replace(/\/+$/, "");
};

export const siteUrl = normalizeSiteUrl(import.meta.env.VITE_SITE_URL);
export const socialImageUrl = `${siteUrl}/og-image.svg`;

const pages = {
  public: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    robots: "index,follow,max-image-preview:large",
  },
  algorithms: {
    title: `${BRAND.name} Algorithms — Interactive Visualizations`,
    description:
      "Learn searching, sorting, greedy, backtracking, sliding-window, and dynamic-programming algorithms through interactive visualizations.",
    robots: "index,follow,max-image-preview:large",
  },
  private: {
    title: `${BRAND.name} Workspace — Visual Code Debugger`,
    description: `Authenticated ${BRAND.name} workspace for stepping through code and inspecting runtime state.`,
    robots: "noindex,nofollow,noarchive",
  },
  admin: {
    title: `${BRAND.name} Admin`,
    description: `Private ${BRAND.name} administration workspace.`,
    robots: "noindex,nofollow,noarchive",
  },
} as const;

const setMeta = (selector: string, attribute: "name" | "property", value: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, selector.match(/=\"([^\"]+)/)?.[1] ?? "");
    document.head.appendChild(element);
  }
  element.content = value;
};

const setLink = (rel: string, href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
};

const structuredData = () => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: BRAND.name,
      url: `${siteUrl}/`,
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      name: BRAND.name,
      description: `${BRAND.positioning}. ${BRAND.tagline}`,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Windows, macOS, Linux",
      url: `${siteUrl}/`,
      downloadUrl: "https://github.com/pratikdas018/codeSight/releases/latest",
      softwareVersion: "1.0.7",
    },
  ],
});

export const Seo = () => {
  const location = useLocation();

  useEffect(() => {
    const isAdmin = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
    const isAuthConfirm = window.location.pathname === "/auth/confirm";
    const isPublicAlgorithm = location.pathname === "/algorithms";
    const isPlatform = [
      "/home",
      "/playground",
      "/algorithms",
      "/data-structures",
      "/compiler",
      "/sql-lab",
      "/tools",
      "/resources",
    ].includes(location.pathname);
    const page = isAdmin ? pages.admin : isAuthConfirm ? pages.private : isPublicAlgorithm ? pages.algorithms : isPlatform ? pages.private : pages.public;
    const canonicalPath = isAdmin || isAuthConfirm || (isPlatform && !isPublicAlgorithm) ? "/" : isPublicAlgorithm ? "/algorithms" : "/";
    const canonical = `${siteUrl}${canonicalPath}`;

    document.documentElement.lang = "en";
    document.title = page.title;
    setMeta('meta[name="description"]', "name", page.description);
    setMeta('meta[name="robots"]', "name", page.robots);
    setMeta('meta[name="application-name"]', "name", BRAND.name);
    setMeta('meta[name="theme-color"]', "name", BRAND.colors.background);
    setMeta('meta[property="og:type"]', "property", "website");
    setMeta('meta[property="og:site_name"]', "property", BRAND.name);
    setMeta('meta[property="og:title"]', "property", page.title);
    setMeta('meta[property="og:description"]', "property", page.description);
    setMeta('meta[property="og:url"]', "property", canonical);
    setMeta('meta[property="og:image"]', "property", socialImageUrl);
    setMeta('meta[name="twitter:card"]', "name", "summary_large_image");
    setMeta('meta[name="twitter:title"]', "name", page.title);
    setMeta('meta[name="twitter:description"]', "name", page.description);
    setMeta('meta[name="twitter:image"]', "name", socialImageUrl);
    setLink("canonical", canonical);

    const verification =
      import.meta.env.VITE_GOOGLE_SITE_VERIFICATION?.trim() ||
      GOOGLE_SITE_VERIFICATION;
    if (verification) setMeta('meta[name="google-site-verification"]', "name", verification);

    let jsonLd = document.head.querySelector<HTMLScriptElement>('script[data-codesight-schema="true"]');
    if (!jsonLd) {
      jsonLd = document.createElement("script");
      jsonLd.type = "application/ld+json";
      jsonLd.dataset.codesightSchema = "true";
      document.head.appendChild(jsonLd);
    }
    jsonLd.textContent = isAdmin || isAuthConfirm || (isPlatform && !isPublicAlgorithm) ? "" : JSON.stringify(structuredData());
  }, [location.pathname]);

  return null;
};
