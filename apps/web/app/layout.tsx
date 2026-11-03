import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "../store/StoreProvider";
import { AppShell } from "../components/AppShell";

export const metadata: Metadata = {
  title: "Learnly — Calm EdTech Platform",
  description: "Modern asynchronous classroom dashboards and live virtual classes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="bg-canvas font-sans antialiased">
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
