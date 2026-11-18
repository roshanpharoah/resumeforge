import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "ResumeForge | ATS score, tailoring and honest resume editing",
    template: "%s | ResumeForge",
  },
  description:
    "Upload your resume, see exactly what an ATS reads, score it across eight dimensions, tailor it to a job without inventing claims, and export a clean one page file.",
  applicationName: "ResumeForge",
  keywords: ["ATS resume checker", "resume tailor", "resume score", "job application", "cover letter"],
  authors: [{ name: "ResumeForge" }],
  openGraph: {
    title: "ResumeForge",
    description: "Know your ATS score. Tailor every application. Never invent a claim.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

const themeScript = `
  try {
    var stored = localStorage.getItem("rf-theme");
    var dark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
