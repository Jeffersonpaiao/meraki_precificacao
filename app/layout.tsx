import type { Metadata } from "next";
import "./meraki.css";

export const metadata: Metadata = {
  title: "Meraki Precificação",
  description: "Gestão inteligente de custos, preços e rentabilidade para clínicas.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
