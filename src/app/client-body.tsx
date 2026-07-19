"use client";

export default function ClientBody({ children }: { children: React.ReactNode }) {
  return <body className="antialiased">{children}</body>;
}
