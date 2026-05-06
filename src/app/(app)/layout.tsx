import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { SessionProvider } from "@/components/session-provider";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    role: session.user.role,
  };

  return (
    <SessionProvider>
      <div className="min-h-dvh flex flex-col">
        <Nav user={user} />
        <main className="container flex-1 py-8 md:py-12">{children}</main>
        <footer className="border-t border-border/60 py-6">
          <div className="container text-center text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
            Moon Club de Lectura ✦ Bajo la misma luna
          </div>
        </footer>
      </div>
    </SessionProvider>
  );
}
