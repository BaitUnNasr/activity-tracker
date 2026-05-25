import { Google_Sans } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/src/components/theme-provider";
import { TooltipProvider } from "@/src/components/ui/tooltip"
import { QueryProvider } from "@/src/components/query-provider";
import { cn } from "@/src/lib/utils";

const googleSans = Google_Sans({ subsets: ['latin'], variable: '--font-sans' });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", googleSans.variable, "font-sans")}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <QueryProvider>{children}</QueryProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
