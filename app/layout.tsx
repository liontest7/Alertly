import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Alertly | Precision Solana Trading",
  description: "Real-time Solana trading intelligence and automation. Snipe, trade, and track with millisecond precision.",
  generator: "v0.app",
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
