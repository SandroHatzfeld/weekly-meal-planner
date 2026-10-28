import type { Metadata, Viewport } from "next";
import PwaSetup from "@/components/pwa/PwaSetup";
import FeedbackProvider from "@/components/ui/Feedback";
import "./globals.css";


export const metadata: Metadata = {
  title: "Weekly Meal Planner",
  description: "Gerichte planen und Einkaufen",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Mealplanner", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#047857",
  // Tastatur verkleinert die Seite (Android): Popups bleiben mittig über der Tastatur, Inhalt wird nicht verdeckt
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <FeedbackProvider>{children}</FeedbackProvider>
        <PwaSetup />
      </body>
    </html>
  );
}
