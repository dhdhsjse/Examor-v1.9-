import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exam Builder",
  description: "Create clean exam papers in minutes",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
