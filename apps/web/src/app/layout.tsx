import type { Metadata, Viewport } from "next";
import { Literata, Source_Sans_3 } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-jose-sans",
});

const display = Literata({
  subsets: ["latin"],
  variable: "--font-jose-display",
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
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-presentation="adventure"
      className={`${sans.variable} ${display.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
