import { MoonLogo } from "@/components/moon-logo";

export default function Loading() {
  return (
    <div className="container flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4 animate-fade-up">
        <MoonLogo size={64} className="mx-auto animate-float" />
        <p className="hand-script text-2xl text-muted-foreground">cargando ✦</p>
      </div>
    </div>
  );
}
