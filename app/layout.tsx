import type { Metadata } from "next";
import { Public_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Relay",
  description:
    "Real-time ops console for tickets, incidents, and service health.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body
        className="h-full flex flex-col overflow-hidden"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
