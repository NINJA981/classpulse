import type { Metadata } from "next";
import {
  Plus_Jakarta_Sans,
  Kalam,
  Outfit,
  Architects_Daughter,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

/* ClassPulse Zine Explainer type stack (all exposed as CSS variables,
   consumed by @theme in globals.css). */

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const architects = Architects_Daughter({
  variable: "--font-architects",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Student Dashboard",
  description: "Student academic portal — assignments, tests and live quizzes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${kalam.variable} ${outfit.variable} ${architects.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
