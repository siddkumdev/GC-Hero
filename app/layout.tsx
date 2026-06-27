import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import Background from "@/components/Background";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// "Civic" design system pairing: Space Grotesk (display) + Inter (body).
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

// NOTE: functional metadata only. No visual/theme design yet (Rule #1).
export const metadata: Metadata = {
  title: "GCHeros",
  description: "Report and track local civic issues.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "GCHeros" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0C10",
};

import Sidebar from "@/components/Sidebar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="civic min-h-[100dvh] flex flex-col lg:flex-row relative bg-transparent">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <Background />
          <Sidebar />
          <div className="w-full max-w-md lg:max-w-5xl flex flex-col flex-1 px-4 lg:px-12 pt-2 pb-32 lg:pb-12 lg:pt-8 mx-auto">
            <Nav />
            <main className="flex-1 pt-5 lg:pt-0">{children}</main>
          </div>
          <BottomNav />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}

