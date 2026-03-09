import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.ALERTLY_API_BASE_URL ||
  "http://localhost:10000";

const metadataBase = new URL(APP_BASE_URL);

export const metadata: Metadata = {
  metadataBase,
  title: "Alertly | Precision Solana Trading",
  description: "Real-time Solana trading intelligence and automation. Snipe, trade, and track with millisecond precision.",
  generator: "Next.js",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/images/logo.png",
  },
  openGraph: {
    title: "Alertly | Precision Solana Trading",
    description: "Real-time Solana trading intelligence and automation. Snipe, trade, and track with millisecond precision.",
    url: APP_BASE_URL,
    siteName: "Alertly",
    images: [
      {
        url: "/images/logo.png",
        width: 800,
        height: 600,
        alt: "Alertly Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Alertly | Precision Solana Trading",
    description: "Real-time Solana trading intelligence and automation. Snipe, trade, and track with millisecond precision.",
    images: ["/images/logo.png"],
  },
}

import { Providers } from "@/components/providers"
import "@solana/wallet-adapter-react-ui/styles.css"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
