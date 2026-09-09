import type { Metadata, Viewport } from "next";
import { Nunito, Playfair_Display } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import { PreferencesBoot } from "@/components/preferences-boot";
import "./globals.css";

const sans = Nunito({
  subsets: ["latin"],
  variable: "--font-jose-sans",
  display: "swap",
  preload: true,
});

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-jose-display",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "Jose",
    template: "%s | Jose",
  },
  description: "Short lessons and games for learning with Jose.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a1a3e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${sans.variable} ${display.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <PreferencesBoot />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
