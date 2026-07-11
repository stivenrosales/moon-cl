import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { OnboardingForm } from "./onboarding-form";

// Vive FUERA del grupo (app) a propósito: el layout de (app) redirige acá
// cuando falta onboardedAt, así que esta página no puede estar dentro de
// ese grupo o entraríamos en un loop de redirect.
export const dynamic = "force-dynamic";

export const metadata = { title: "Bienvenida" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.onboardedAt) redirect("/dashboard");

  return (
    <div className="container flex min-h-dvh items-center justify-center py-16">
      <OnboardingForm initialName={session.user.name ?? ""} />
    </div>
  );
}
