import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const plexMono = localFont({
  src: [
    { path: "../../public/fonts/ibm-plex-mono-400.woff2", weight: "400" },
    { path: "../../public/fonts/ibm-plex-mono-500.woff2", weight: "500" },
    { path: "../../public/fonts/ibm-plex-mono-600.woff2", weight: "600" },
  ],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

const plexSans = localFont({
  src: [
    { path: "../../public/fonts/ibm-plex-sans-400.woff2", weight: "400" },
    { path: "../../public/fonts/ibm-plex-sans-500.woff2", weight: "500" },
    { path: "../../public/fonts/ibm-plex-sans-600.woff2", weight: "600" },
  ],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0f14",
};

export const metadata: Metadata = {
  title: "TacticsDuel",
  description: "Build. Tacticate. Duel.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TacticsDuel",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexMono.variable} ${plexSans.variable} h-full`}
    >
      <body className="min-h-dvh flex flex-col bg-bg text-text">
        {children}
      </body>
    </html>
  );
}
