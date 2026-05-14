import { Geist, Geist_Mono, Noto_Sans, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/src/components/theme-provider"
import { cn } from "@/src/lib/utils";

const interHeading = Inter({subsets:['latin'],variable:'--font-heading'});

const notoSans = Noto_Sans({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", notoSans.variable, interHeading.variable)}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
