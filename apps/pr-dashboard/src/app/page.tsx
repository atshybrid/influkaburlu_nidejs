"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getAccessToken } from "@/lib/storage";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();
    router.replace(token ? "/dashboard" : "/login");
  }, [router]);

  return (
    <main style={{ padding: 16 }}>
      <h1>Kaburlu PR Dashboard</h1>
      <p>Redirecting…</p>
    </main>
  );
}
