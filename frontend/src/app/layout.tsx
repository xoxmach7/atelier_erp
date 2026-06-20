import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/app-shell";

const ttNormsPro = localFont({
  src: [
    {
      path: "../../public/fonts/TTNormsPro-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/TTNormsPro-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/TTNormsPro-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/TTNormsPro-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/TTNormsPro-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-tt-norms",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sheber ERP",
  description: "ERP система для ателье по пошиву штор",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${ttNormsPro.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#F0F4F8]">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
