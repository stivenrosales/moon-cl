import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth, signIn } from "@/lib/auth";
import { MoonLogo } from "@/components/moon-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { error } = await searchParams;

  async function magicLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    await signIn("resend", { email, redirectTo: "/dashboard" });
  }

  return (
    <div className="container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-md space-y-10 animate-fade-up">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver
        </Link>

        <div className="text-center">
          <MoonLogo size={84} className="mx-auto" />
          <h1 className="display mt-6 text-3xl md:text-4xl leading-tight">
            Bienvenida al <span className="hand-script text-primary">club</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Te enviamos un enlace mágico para entrar. Sin contraseñas.
          </p>
        </div>

        <form action={magicLink} className="space-y-5 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md p-6 shadow-2xl">
          <div className="space-y-2">
            <Label htmlFor="email">Tu correo</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="tunombre@correo.com"
            />
          </div>
          <Button type="submit" className="w-full" size="lg">
            Enviarme el enlace mágico
          </Button>

          {error ? (
            <p className="text-center text-xs text-destructive">
              Hubo un problema, intenta de nuevo.
            </p>
          ) : null}
        </form>

        <p className="text-center text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
          ✦ Magia simple, sin contraseñas ✦
        </p>
      </div>
    </div>
  );
}
