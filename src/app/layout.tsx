import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "غرفة الدراسة التشاركية | Mastery Study Room",
  description: "غرفة دراسة تشاركية قائمة على التميز وإتقان المفاهيم بالذكاء الاصطناعي",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="h-full w-full">
      <body className="min-h-full w-full bg-silver-fog text-midnight-ink antialiased overflow-x-hidden font-arabic">
        {children}
      </body>
    </html>
  );
}
