import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Matcher",
  description: "Semantic job matching for students and recruiters",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
