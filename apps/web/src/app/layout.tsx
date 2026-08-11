import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const sans = Nunito({
  subsets: ["latin"],
  variable: "--font-jose-sans",
});

const display = Fredoka({
  subsets: ["latin"],
  variable: "--font-jose-display",
});

export const metadata: Metadata = {
  title: {
    default: "Jose — Work and Life of Rizal",
    template: "%s — Jose",
  },
  description:
    "A kids-first adventure through the life and works of José Rizal.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#A855F7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full`}>
      <body className="min-h-full antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
