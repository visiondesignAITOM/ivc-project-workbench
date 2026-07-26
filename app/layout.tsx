import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const pageUrl = "https://visiondesignaitom.github.io/ivc-project-workbench/";
const socialImage = new URL("og-ivc-logo.png", pageUrl).toString();
const title = "IVC 專案工作台";
const description = "把專案變更拆成可管理、可驗證、可推進的工作。";

export const metadata: Metadata = {
  metadataBase: new URL(pageUrl),
  title,
  description,
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
  openGraph: {
    title,
    description,
    type: "website",
    url: pageUrl,
    images: [{ url: socialImage, width: 1536, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [socialImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
