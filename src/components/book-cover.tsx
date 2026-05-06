import Image from "next/image";
import { Book as BookIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookCoverProps {
  src?: string | null;
  title: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: { w: 56, h: 84, cls: "w-14 h-20" },
  md: { w: 96, h: 144, cls: "w-24 h-36" },
  lg: { w: 144, h: 216, cls: "w-36 h-52" },
  // xl: 156x234 en mobile, 200x300 en md+
  xl: { w: 200, h: 300, cls: "w-[10rem] h-[15rem] md:w-48 md:h-72" },
};

export function BookCover({ src, title, className, size = "md" }: BookCoverProps) {
  const s = sizes[size];
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md ring-1 ring-border/70 bg-gradient-to-br from-primary/20 to-accent/15 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)]",
        s.cls,
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={`Portada de ${title}`}
          width={s.w}
          height={s.h}
          className="h-full w-full object-cover"
          sizes={`${s.w}px`}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2 text-center text-muted-foreground">
          <BookIcon className="h-5 w-5 text-primary/60" />
          <span className="line-clamp-3 text-[10px] uppercase tracking-wider">{title}</span>
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-black/30 to-transparent"
        aria-hidden
      />
    </div>
  );
}
