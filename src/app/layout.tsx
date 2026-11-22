import type { Metadata } from "next";
import "@fontsource/young-serif/400.css";
import "@fontsource-variable/figtree";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Schedulr",
  description: "Your events, meetings, tasks and reminders, kept on your own laptop.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
