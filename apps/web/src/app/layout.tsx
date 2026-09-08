import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import { PreferencesBoot } from "@/components/preferences-boot";
import "./globals.css";

const sans = Nunito({
  subsets: ["latin"],
  variable: "--font-jose-sans",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "Jose — Work and Life of Rizal",
    template: "%s — Jose",
  },
  description:
    "A historical investigation adventure through the life and works of José Rizal for APC RIZLIFE and curious younger learners.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#58cc02",
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
      className={`${sans.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <PreferencesBoot />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
