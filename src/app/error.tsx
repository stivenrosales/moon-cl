"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MoonLogo } from "@/components/moon-logo";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container flex min-h-screen items-center justify-center py-16">
      <div className="text-center space-y-6 max-w-md">
        <MoonLogo size={84} className="mx-auto opacity-60" />
        <h1 className="display text-3xl">Algo se nubló</h1>
        <p className="text-sm text-muted-foreground">
          {error.message ?? "Ocurrió un error inesperado."}
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={reset}>Reintentar</Button>
          <Button asChild variant="outline">
            <Link href="/">Inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
