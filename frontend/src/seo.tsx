import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const PRODUCTION_SITE_URL = "https://getcodesight.vercel.app";
const DEFAULT_TITLE = "CodeSight — Visual Code Debugger & Execution Visualizer";
const DEFAULT_DESCRIPTION =
  "Understand how code executes with CodeSight: visualize execution step by step, inspect variables, and explore stack and heap memory.";
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
  private: {
    title: "CodeSight Workspace — Visual Debugger",
    description: "Authenticated CodeSight workspace for stepping through code and inspecting runtime state.",
    robots: "noindex,nofollow,noarchive",
  },
  admin: {
    title: "CodeSight Admin",
    description: "Private CodeSight administration workspace.",
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
      name: "CodeSight",
      url: `${siteUrl}/`,
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      name: "CodeSight",
      description: DEFAULT_DESCRIPTION,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Windows, macOS, Linux",
      url: `${siteUrl}/`,
      downloadUrl: "https://github.com/pratikdas018/codeSight/releases/download/v.1.0.5/CodeSight-1.0.5-win-x64.exe",
      softwareVersion: "1.0.6",
    },
  ],
});

export const Seo = () => {
  const location = useLocation();

  useEffect(() => {
    const isAdmin = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
    const isAuthConfirm = window.location.pathname === "/auth/confirm";
    const page = isAdmin ? pages.admin : isAuthConfirm ? pages.private : pages.public;
    const canonicalPath = isAdmin || isAuthConfirm ? "/" : "/";
    const canonical = `${siteUrl}${canonicalPath}`;

    document.documentElement.lang = "en";
    document.title = page.title;
    setMeta('meta[name="description"]', "name", page.description);
    setMeta('meta[name="robots"]', "name", page.robots);
    setMeta('meta[name="application-name"]', "name", "CodeSight");
    setMeta('meta[name="theme-color"]', "name", "#050505");
    setMeta('meta[property="og:type"]', "property", "website");
    setMeta('meta[property="og:site_name"]', "property", "CodeSight");
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
    jsonLd.textContent = isAdmin || isAuthConfirm ? "" : JSON.stringify(structuredData());
  }, [location.pathname]);

  return null;
};
