import type { Metadata } from "next";
// Self-hosted Geist (no build-time font fetch — required for sandboxed builds)
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ClerkProvider } from "@clerk/nextjs";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
};

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({ children }: LayoutProps<"/">) {
  const inner = (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-ink">
        {children}
      </body>
    </html>
  );

  // App must boot before Clerk keys exist (Phase 0). Once keys are set in env,
  // ClerkProvider activates automatically — no code change needed.
  return clerkEnabled ? <ClerkProvider>{inner}</ClerkProvider> : inner;
}
