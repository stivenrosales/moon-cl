import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Nav } from "@/components/nav";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { SessionProvider } from "@/components/session-provider";
import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user?.id) redirect(routes.login());

  // onboardedAt viaja en session.user desde el callback `session` de
  // NextAuth (src/lib/auth.ts): con session strategy "database" el adapter
  // resuelve el User completo en cada auth(), así que no hace falta una
  // query aparte acá.
  if (!session.user.onboardedAt) redirect(routes.onboarding());

  const user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    role: session.user.role,
  };

  const unreadCount = await db.message.count({
    where: { receiverId: user.id, readAt: null },
  });

  return (
    <SessionProvider>
      <div className="min-h-dvh flex flex-col">
        <Nav user={user} unreadCount={unreadCount} />
        <main className="container flex-1 py-5 pb-[calc(56px+env(safe-area-inset-bottom)+16px)] md:py-8 md:pb-0">
          {children}
        </main>
        <footer className="border-t border-border/60 py-4">
          <div className="container text-center text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
            Moon Club de Lectura ✦ Bajo la misma luna
          </div>
        </footer>
        <BottomTabBar user={user} />
      </div>
    </SessionProvider>
  );
}
