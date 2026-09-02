import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { STUDIO } from "@/lib/legal";

/**
 * JSON-LD for the landing page, rendered as a `<script type="application/ld+json">`
 * directly in `app/page.tsx` - the Metadata API has no field for it, so this
 * is the documented way to attach structured data in the App Router.
 *
 * Deliberately excludes `aggregateRating` / `review`: Losto collects neither,
 * and schema.org markup for ratings that don't exist is exactly the kind of
 * thing that gets a manual action from Google, not better rankings.
 */
export function buildLandingJsonLd() {
  const icon = `${SITE_URL}/web-app-manifest-512x512.png`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: SITE_URL,
        description: DEFAULT_DESCRIPTION,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any (installable web app)",
        image: icon,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        publisher: { "@id": `${STUDIO.site}/#organization` },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        publisher: { "@id": `${STUDIO.site}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${STUDIO.site}/#organization`,
        name: STUDIO.name,
        url: STUDIO.site,
        email: STUDIO.email,
        slogan: STUDIO.tagline,
        logo: icon,
      },
    ],
  };
}
