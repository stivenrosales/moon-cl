"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { Prisma, type ReportStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { idSchema, reportSchema } from "@/lib/validators";
import { requireModerator, requireUser } from "@/server/auth-helpers";
import { buildReportNotificationHtml, buildReportNotificationText } from "@/lib/email";

function isDuplicateBlockError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Bloquea a otro usuario. Idempotente (P2002 del índice único
 * @@unique([blockerId, blockedId]) se trata como éxito silencioso, mismo
 * patrón que followUser en actions/follow.ts).
 */
export async function blockUser(targetUserId: string) {
  const user = await requireUser();
  const blockedId = idSchema.parse(targetUserId);

  if (blockedId === user.id) {
    throw new Error("No puedes bloquearte a ti mismo");
  }

  try {
    await db.block.create({ data: { blockerId: user.id, blockedId } });
  } catch (err) {
    if (!isDuplicateBlockError(err)) throw err;
  }

  revalidatePath("/mensajes");
  revalidatePath(`/perfil/${blockedId}`);
}

/**
 * Desbloquea a otro usuario. deleteMany es idempotente: si no existía el
 * bloqueo, no lanza.
 */
export async function unblockUser(targetUserId: string) {
  const user = await requireUser();
  const blockedId = idSchema.parse(targetUserId);

  await db.block.deleteMany({ where: { blockerId: user.id, blockedId } });

  revalidatePath("/mensajes");
  revalidatePath(`/perfil/${blockedId}`);
}

/**
 * Crea un Report y notifica por email a los moderadores/admins. El email
 * es deliberadamente sobrio: solo categoría + sub-razón, SIN el contenido
 * del hilo reportado — el contexto completo (mensajes) se revisa dentro
 * del panel /admin, nunca sale del sistema por correo.
 */
export async function reportConversation(input: unknown) {
  const user = await requireUser();
  const data = reportSchema.parse(input);

  if (data.reportedUserId === user.id) {
    throw new Error("No puedes reportarte a ti mismo");
  }

  const report = await db.report.create({
    data: {
      reporterId: user.id,
      reportedUserId: data.reportedUserId,
      category: data.category,
      subReason: data.subReason ?? null,
      details: data.details ?? null,
      messageId: data.messageId ?? null,
    },
  });

  await notifyModerators({ category: data.category, subReason: data.subReason ?? null });

  revalidatePath("/admin");
  return report;
}

async function notifyModerators(report: { category: string; subReason: string | null }) {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) return; // sin key configurada (dev/local): no rompe la action, solo no envía

  const moderators = await db.user.findMany({
    where: { role: { in: ["ADMIN", "MODERATOR"] } },
    select: { email: true },
  });
  const recipients = moderators.map((m) => m.email).filter((e): e is string => !!e);
  if (recipients.length === 0) return;

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? "Moon Club <onboarding@resend.dev>";
  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const adminUrl = `${baseUrl}/admin`;
  const subject = "Nuevo reporte recibido";
  const html = buildReportNotificationHtml({ report: { ...report, adminUrl } });
  const text = buildReportNotificationText({ report: { ...report, adminUrl } });

  if (recipients.length === 1) {
    await resend.emails.send({ from, to: recipients[0], subject, html, text });
  } else {
    await resend.batch.send(recipients.map((to) => ({ from, to, subject, html, text })));
  }
}

/**
 * Últimos ~30 mensajes del hilo entre reportante y reportado, para que un
 * moderador revise el contexto real de un reporte. Único lugar del sistema
 * donde un DM ajeno se hace visible a alguien que no es parte de la
 * conversación — por eso exige requireModerator, y solo se llama al
 * expandir un reporte puntual (nunca se precargan hilos de otros).
 */
export async function getReportThread(reportId: string) {
  await requireModerator();
  const parsedId = idSchema.parse(reportId);

  const report = await db.report.findUnique({
    where: { id: parsedId },
    select: { reporterId: true, reportedUserId: true },
  });
  if (!report) {
    throw new Error("Reporte no encontrado");
  }

  const messages = await db.message.findMany({
    where: {
      OR: [
        { senderId: report.reporterId, receiverId: report.reportedUserId },
        { senderId: report.reportedUserId, receiverId: report.reporterId },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return messages.reverse();
}

/**
 * Resuelve un reporte (RESOLVED o DISMISSED). Solo moderadores/admins.
 */
export async function resolveReport(id: string, status: ReportStatus) {
  const moderator = await requireModerator();
  const parsedId = idSchema.parse(id);

  if (status === "OPEN") {
    throw new Error("Estado de resolución no válido");
  }

  await db.report.update({
    where: { id: parsedId },
    data: { status, resolvedAt: new Date(), resolvedById: moderator.id },
  });

  revalidatePath("/admin");
}
