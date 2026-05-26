import { Oswald, Open_Sans } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/src/components/theme-provider";
import { TooltipProvider } from "@/src/components/ui/tooltip"
import { QueryProvider } from "@/src/components/query-provider";
import { cn } from "@/src/lib/utils";

const oswald = Oswald({ subsets: ['latin'], variable: '--font-heading' });
const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-sans' });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", openSans.variable, oswald.variable)}>
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
