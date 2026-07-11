"use client";

import * as React from "react";
import { ChevronDown, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getReportThread, resolveReport } from "@/server/actions/moderation";
import { REPORT_CATEGORY_LABELS, type ReportCategory } from "@/lib/report-categories";
import { cn, formatDateTime, getInitials } from "@/lib/utils";

interface ReportUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface ReportRow {
  id: string;
  category: string;
  subReason: string | null;
  details: string | null;
  createdAt: Date;
  reporter: ReportUser;
  reportedUser: ReportUser;
}

interface ThreadMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────
// Único lugar del sistema donde se muestran DMs ajenos: al expandir un
// reporte se cargan (bajo demanda, no precargados) los últimos ~30
// mensajes del hilo entre reportante y reportado vía getReportThread. El
// reportante solo se identifica AQUÍ — nunca fuera del panel de
// moderación (contrato de anonimato del reporte).
// ─────────────────────────────────────────────────────────────────────────

export function ReportsPanel({ reports }: { reports: ReportRow[] }) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [threads, setThreads] = React.useState<Record<string, ThreadMessage[]>>({});
  const [loadingThreadId, setLoadingThreadId] = React.useState<string | null>(null);
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);

  async function toggleExpand(report: ReportRow) {
    const next = expandedId === report.id ? null : report.id;
    setExpandedId(next);
    if (next && !threads[report.id]) {
      setLoadingThreadId(report.id);
      try {
        const messages = await getReportThread(report.id);
        setThreads((prev) => ({ ...prev, [report.id]: messages }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo cargar el hilo");
      } finally {
        setLoadingThreadId(null);
      }
    }
  }

  async function handleResolve(id: string, status: "RESOLVED" | "DISMISSED") {
    setResolvingId(id);
    try {
      await resolveReport(id, status);
      toast.success(status === "RESOLVED" ? "Reporte resuelto" : "Reporte desestimado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el reporte");
    } finally {
      setResolvingId(null);
    }
  }

  if (reports.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay reportes abiertos.</p>;
  }

  return (
    <ul className="divide-y divide-border/60">
      {reports.map((report) => {
        const expanded = expandedId === report.id;
        const thread = threads[report.id];
        const isResolving = resolvingId === report.id;
        const categoryLabel =
          REPORT_CATEGORY_LABELS[report.category as ReportCategory] ?? report.category;

        return (
          <li key={report.id} className="py-3 space-y-2.5">
            <button
              type="button"
              onClick={() => toggleExpand(report)}
              className="flex w-full flex-wrap items-center gap-2 text-left focus-ring rounded-md"
            >
              <Badge variant="destructive">{categoryLabel}</Badge>
              {report.subReason ? (
                <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                  {report.subReason}
                </span>
              ) : null}
              <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatDateTime(report.createdAt)}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </button>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Reportante:{" "}
                <strong className="font-medium text-foreground">
                  {report.reporter.name ?? report.reporter.email}
                </strong>
              </span>
              <span>
                Reportado/a:{" "}
                <strong className="font-medium text-foreground">
                  {report.reportedUser.name ?? report.reportedUser.email}
                </strong>
              </span>
            </div>

            {report.details ? (
              <p className="text-sm text-foreground/90">{report.details}</p>
            ) : null}

            {expanded ? (
              <div className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-3">
                {loadingThreadId === report.id ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : thread && thread.length > 0 ? (
                  <ul className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                    {thread.map((m) => {
                      const isReporter = m.senderId === report.reporter.id;
                      const author = isReporter ? report.reporter : report.reportedUser;
                      return (
                        <li key={m.id} className="flex gap-2">
                          <Avatar className="h-6 w-6 shrink-0">
                            {author.image ? <AvatarImage src={author.image} alt="" /> : null}
                            <AvatarFallback className="text-[9px]">
                              {getInitials(author.name, author.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-[11px] text-muted-foreground">
                              {author.name ?? author.email}{" "}
                              <span className="tabular-nums">· {formatDateTime(m.createdAt)}</span>
                            </p>
                            <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Sin mensajes en este hilo.
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResolve(report.id, "DISMISSED")}
                    disabled={isResolving}
                  >
                    <ShieldX className="h-3.5 w-3.5" /> Desestimar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleResolve(report.id, "RESOLVED")}
                    disabled={isResolving}
                  >
                    {isResolving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    Resolver
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
