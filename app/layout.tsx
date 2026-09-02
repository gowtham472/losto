import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { ToastProvider } from "@/components/ui/toast";
import { STUDIO } from "@/lib/legal";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, OG_LOCALE, SITE_NAME, SITE_URL } from "@/lib/seo";
import { LibraryProvider } from "@/lib/store";
import "katex/dist/katex.min.css";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s · Losto",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  keywords: [
    "save ChatGPT conversation",
    "save AI chat offline",
    "offline AI chat reader",
    "save Claude chat",
    "save Perplexity answers",
    "read AI chats offline",
    "offline study app",
    "PWA for students",
  ],
  authors: [{ name: STUDIO.name, url: STUDIO.site }],
  creator: STUDIO.name,
  publisher: STUDIO.name,
  category: "education",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: OG_LOCALE,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: "Losto",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  /**
   * Unset unless the site is verified with Search Console - an empty
   * verification tag is harmless, but there's no reason to ship one.
   */
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  /*
   * No `icons` block on purpose. app/favicon.ico, app/icon.svg, app/icon1.png
   * and app/apple-icon.png are picked up by the App Router's file convention
   * and the tags are generated from those. Declaring them here as well would
   * mean two sources of truth for the same image.
   */
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbfbfc",
  colorScheme: "light dark",
};

/** Runs before first paint so a dark-theme user never sees a white flash. */
const THEME_SCRIPT = `(function(){try{
var s=localStorage.getItem('losto:settings');
var t=s?JSON.parse(s).theme:'system';
var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.dataset.theme=d?'dark':'light';
}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${bricolage.variable} ${jetbrains.variable} ${newsreader.variable}`}
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: pre-paint theme sync */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-page antialiased">
        <ToastProvider>
          <LibraryProvider>
            <AppShell>{children}</AppShell>
            <ServiceWorkerRegistrar />
          </LibraryProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
