import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Nav } from "@/components/nav";
import { SessionProvider } from "@/components/session-provider";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  // onboardedAt viaja en session.user desde el callback `session` de
  // NextAuth (src/lib/auth.ts): con session strategy "database" el adapter
  // resuelve el User completo en cada auth(), así que no hace falta una
  // query aparte acá.
  if (!session.user.onboardedAt) redirect("/onboarding");

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
        <main className="container flex-1 py-5 md:py-8">{children}</main>
        <footer className="border-t border-border/60 py-4">
          <div className="container text-center text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
            Moon Club de Lectura ✦ Bajo la misma luna
          </div>
        </footer>
      </div>
    </SessionProvider>
  );
}
