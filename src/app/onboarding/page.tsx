import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { routes } from "@/lib/routes";
import { OnboardingForm } from "./onboarding-form";

// Vive FUERA del grupo (app) a propósito: el layout de (app) redirige acá
// cuando falta onboardedAt, así que esta página no puede estar dentro de
// ese grupo o entraríamos en un loop de redirect.
export const dynamic = "force-dynamic";

export const metadata = { title: "Bienvenida" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect(routes.login());
  if (session.user.onboardedAt) redirect(routes.hoy());

  return (
    <div className="container flex min-h-dvh items-center justify-center py-16">
      <OnboardingForm initialName={session.user.name ?? ""} />
    </div>
  );
}
