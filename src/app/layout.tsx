import type { Metadata } from "next";
import { ThemeProvider, themeInitScript } from "@/components/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "WealthOS — Personal Financial Operating System",
  description:
    "AI-powered personal finance management for India. WealthOS calculates. AI interprets. The user decides.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
