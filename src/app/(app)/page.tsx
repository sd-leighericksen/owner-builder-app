"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    apiGet<{ items: Array<{ id: string }> }>("/api/v1/projects")
      .then((r) => {
        router.replace(r.items.length > 0 ? `/projects/${r.items[0].id}` : "/projects/new");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
      });
  }, [router]);

  return <Spinner />;
}
