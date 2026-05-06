import type { Metadata, Viewport } from "next";
import { Fraunces, Karla, Caveat } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Starfield } from "@/components/starfield";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const sans = Karla({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const hand = Caveat({
  subsets: ["latin"],
  variable: "--font-hand",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Moon · Club de Lectura",
    template: "%s · Moon Club de Lectura",
  },
  description:
    "Sugiere libros, vota lo que leeremos juntos y comparte la lectura bajo la luna. Un club de lectura íntimo, premium y abierto.",
  keywords: ["club de lectura", "moon", "libros", "lectura", "votación", "comunidad"],
  openGraph: {
    title: "Moon · Club de Lectura",
    description:
      "Sugiere libros, vota lo que leeremos juntos y comparte la lectura bajo la luna.",
    type: "website",
    locale: "es_ES",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5EFE2" },
    { media: "(prefers-color-scheme: dark)", color: "#11091F" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${hand.variable}`}
    >
      <body className="min-h-dvh bg-background text-foreground antialiased grain">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <Starfield />
          <div className="relative z-10">{children}</div>
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast:
                  "bg-card text-card-foreground border border-border shadow-xl rounded-xl",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
