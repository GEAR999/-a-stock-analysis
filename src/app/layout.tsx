import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'A股智能分析系统',
  description: '专业的A股智能分析系统，支持缠论、波浪理论、技术指标分析',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
