import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/book-cover";
import { StarRating } from "@/components/star-rating";

export const metadata = { title: "Biblioteca" };

export default async function BibliotecaPage() {
  const books = await db.book.findMany({
    orderBy: [{ isCurrent: "desc" }, { finishedAt: "desc" }, { createdAt: "desc" }],
    include: {
      ratings: { select: { stars: true } },
      _count: { select: { comments: true, ratings: true } },
    },
  });

  const current = books.filter((b) => b.isCurrent);
  const finished = books.filter((b) => b.status === "FINISHED");
  const others = books.filter((b) => !b.isCurrent && b.status !== "FINISHED");

  return (
    <div className="space-y-12">
      <header>
        <span className="text-xs uppercase tracking-[0.32em] text-accent">Memoria del club</span>
        <h1 className="h1-display display mt-2">
          La <span className="hand-script italic text-primary">biblioteca</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Todos los libros que han pasado, pasan o pasarán por nuestra mesa.
        </p>
      </header>

      {current.length > 0 ? (
        <Section title="Leyendo ahora">
          <BookGrid books={current} />
        </Section>
      ) : null}

      {finished.length > 0 ? (
        <Section title="Ya leídos">
          <BookGrid books={finished} />
        </Section>
      ) : null}

      {others.length > 0 ? (
        <Section title="Sugeridos & candidatos">
          <BookGrid books={others} />
        </Section>
      ) : null}

      {books.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="hand-script text-2xl">Todavía no hay libros</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando se sugiera el primero, aparecerá aquí.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

interface BookGridItem {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  isCurrent: boolean;
  ratings: { stars: number }[];
  _count: { comments: number; ratings: number };
}

function BookGrid({ books }: { books: BookGridItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
      {books.map((b) => {
        const avg = b.ratings.length
          ? b.ratings.reduce((s, r) => s + r.stars, 0) / b.ratings.length
          : 0;
        return (
          <Link key={b.id} href={`/libros/${b.id}`} className="group focus-ring rounded-xl">
            <div className="space-y-3">
              <BookCover src={b.coverUrl} title={b.title} size="lg" className="w-full h-auto aspect-[2/3] mx-auto" />
              <div className="space-y-1">
                <h3 className="display text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                  {b.title}
                </h3>
                {b.authors.length ? (
                  <p className="text-xs text-muted-foreground line-clamp-1">{b.authors.join(", ")}</p>
                ) : null}
                {b._count.ratings > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <StarRating value={Math.round(avg)} readOnly size={12} />
                    <span className="text-[10px] text-muted-foreground tabular-nums">{avg.toFixed(1)}</span>
                  </div>
                ) : null}
                {b.isCurrent ? <Badge variant="default" className="mt-1">En curso</Badge> : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
