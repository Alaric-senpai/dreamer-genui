
import type { Metadata } from "next"
import "./globals.css"
// import { ThemeProvider } from "@/components/theme-provider"
// import { cn } from "@/lib/utils";
// import { TooltipProvider } from "@/components/ui/tooltip";
import { JetbrainsMono, Montserrat } from "@/fonts";

export const metadata: Metadata = {
  title: "dreamer-genui playground",
  description: "Tutor-authored JSON rendered as a kinetic blackboard.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`antialiased font-sans ${Montserrat.variable} ${JetbrainsMono.variable}`}
    >
      <body>
        {/*<ThemeProvider>*/}
  {/*<TooltipProvider>*/}
    {children}
  {/*</TooltipProvider>*/}
  {/*</ThemeProvider>*/}
      </body>
    </html>
  )
}
