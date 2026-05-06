import "./globals.css"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { getTenantBranding } from "@/config/tenant"

const branding = getTenantBranding()

export const metadata: Metadata = {
  title: {
    default: branding.seo.title,
    template: `%s | ${branding.shortName}`,
  },
  description: branding.seo.description,
  icons: {
    icon: [
      { url: branding.assets.favicon },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: { url: branding.assets.appleTouchIcon, sizes: "180x180", type: "image/png" },
  },
  manifest: branding.assets.manifest,
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black",
    "apple-mobile-web-app-title": branding.shortName,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-slate-50">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
