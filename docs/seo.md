# CodeSight technical SEO

## Architecture

CodeSight is a React 19/Vite SPA in `frontend/`, using `HashRouter`. The desktop build and browser deployment share the renderer, but the Electron application is not an SEO surface. The browser deployment is configured as a Vercel Vite site.

The only intentionally indexable URL is the public root entry point. The authenticated workspace, email-confirmation route, admin dashboard, and user-specific execution data are not public content and are excluded from crawling/indexing.

## Canonical domain and metadata

The current canonical production URL is `https://getcodesight.vercel.app`, based on the existing Vercel deployment reference. Metadata is centralized in `frontend/src/seo.tsx`; the HTML shell in `frontend/index.html` provides a crawlable fallback before JavaScript runs.

Set `VITE_SITE_URL` in the Vercel project if a custom domain becomes the preferred production host. It should be an HTTPS origin without a trailing slash. The same variable is used by the runtime metadata layer. The checked-in sitemap and robots file must also be updated when the canonical domain changes.

## Implemented files

- `frontend/index.html`: fallback title, description, canonical, social cards, theme, and favicon.
- `frontend/src/seo.tsx`: route-aware metadata and reusable WebSite/SoftwareApplication JSON-LD.
- `frontend/public/sitemap.xml`: homepage-only sitemap with no fabricated last-modified date.
- `frontend/public/robots.txt`: public crawl access, private-route exclusions, and sitemap reference.
- `frontend/public/icon.svg` and `frontend/public/og-image.svg`: first-party favicon and social preview assets.

The structured data uses verified product facts from the repository: CodeSight, its developer-tool category, the configured desktop platforms, the GitHub release download URL, and the package version. It intentionally does not include ratings, reviews, prices, or invented organization claims.

## Search Console

1. In Google Search Console, add the preferred domain property. Domain-property verification via the DNS TXT record is preferred; the DNS record is managed at the domain provider.
2. For the current URL-prefix property, the verification meta tag is implemented in `frontend/index.html` and `frontend/src/seo.tsx` with the token supplied by Google Search Console. Redeploy Vercel, then click **Verify**. If Google generates a new token, replace the value in both files or configure `VITE_GOOGLE_SITE_VERIFICATION` in Vercel.
3. Submit `https://getcodesight.vercel.app/sitemap.xml` (or the custom-domain equivalent).
4. Use URL Inspection for the homepage, request indexing when appropriate, and review Pages/Indexing and Core Web Vitals reports.

No Search Console verification or sitemap submission has been performed by this repository change; those require access to the Google and deployment accounts.

## Validation and limitations

The app is a client-rendered authenticated SPA, so Google receives the strongest available static shell metadata and an indexable root entry, but it does not have server-rendered marketing pages. Hash routes are not useful SEO URLs. If public educational or feature content is added later, give each page a real route, visible content, unique metadata, and a sitemap entry.

The SEO changes do not alter the execution engine, authentication, Electron bridge, Monaco loading, or visualization behavior. Vite already splits Monaco, visualization, and Supabase bundles; the existing lazy route imports are retained.
