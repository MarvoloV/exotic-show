import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { RouteTheme } from "@/components/route-theme";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: { default: "Asistencia QR", template: "%s | Asistencia QR" },
  description: "Base de una aplicación de registro y control de asistencia con QR.",
  referrer: "no-referrer",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={cn("font-sans", geist.variable)}>
      <body className="flex min-h-dvh flex-col antialiased">
        <RouteTheme />
        <a href="#contenido" className="sr-only focus:not-sr-only focus:p-4">Saltar al contenido</a>
        <SiteHeader />
        <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-8 sm:py-20">{children}</main>
        <footer className="border-t border-border px-5 py-6 text-center text-sm text-muted-foreground">
          Asistencia QR · MVP en preparación
        </footer>
      </body>
    </html>
  );
}
