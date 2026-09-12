import type { Metadata } from "next";
import Script from "next/script";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CoComms — Commentary prep & live desk",
  description:
    "Football commentary preparation and live desk. Prep, Scripts, pitch board, and live events — built for matchday.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexMono.variable} antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)]`}
      >
        <Script
          id="pitchline-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='pitchline-theme';var m='pitchline-broadcast-dark-v1';if(!localStorage.getItem(m)){localStorage.setItem(m,'1');localStorage.setItem(k,'dark');}var t=localStorage.getItem(k)||'dark';var dark=t!=='light';var r=document.documentElement;r.classList.toggle('dark',dark);r.classList.toggle('light',!dark);r.style.colorScheme=dark?'dark':'light';}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
        <ThemeProvider>
          <LocaleProvider>{children}</LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
