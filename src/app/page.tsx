"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Client component (not a server redirect): Supabase recovery/invite links land here
 * carrying the session tokens in the URL hash fragment (#access_token=...&type=recovery),
 * which never reaches the server — only client-side JS can read it. See proxy.ts, which
 * exempts "/" from the server-side auth redirect so this code gets a chance to run first.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      router.replace(`/reset-password${hash}`);
      return;
    }
    router.replace("/hoje");
  }, [router]);

  return null;
}
