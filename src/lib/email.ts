import { Resend } from "resend";

interface MagicLinkParams {
  email: string;
  url: string;
  from: string;
}

const BG = "#140E1E"; // --background
const CARD = "#1D1530"; // --card
const BORDER = "#34284E"; // --border
const PRIMARY = "#C69FD5"; // --primary
const PRIMARY_INK = "#2B1838"; // --primary-foreground
const FG = "#F3EEF9"; // --foreground
const MUTED = "#A69BC2"; // --muted-foreground
const TAGLINE = "Lecturas simples, conversaciones profundas.";

export function buildMagicLinkHtml({ url, host }: { url: string; host: string }) {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:${BG};font-family:Inter,Helvetica,Arial,sans-serif;color:${FG};">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${BG};padding:48px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background:linear-gradient(180deg,${BORDER} 0%, ${CARD} 100%);border:1px solid rgba(198,159,213,0.25);border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:40px 40px 16px 40px;text-align:center;">
                <div style="font-family:'Brush Script MT', cursive;font-size:34px;color:${PRIMARY};letter-spacing:0.02em;">Moon</div>
                <div style="font-size:12px;letter-spacing:0.4em;color:${MUTED};text-transform:uppercase;margin-top:6px;">Club de Lectura</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 8px 40px;text-align:center;">
                <h1 style="font-size:22px;font-weight:600;margin:16px 0 8px 0;color:${FG};">Tu enlace mágico</h1>
                <p style="font-size:14px;line-height:1.6;color:${MUTED};margin:0 0 28px 0;">
                  Toca el botón para entrar a <strong>${host}</strong>. El enlace caduca en 24 horas y solo funciona una vez.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 8px 40px;text-align:center;">
                <a href="${url}" style="display:inline-block;background:${PRIMARY};color:${PRIMARY_INK};text-decoration:none;font-weight:600;padding:14px 28px;border-radius:999px;font-size:15px;letter-spacing:0.02em;box-shadow:0 8px 24px rgba(43,24,56,0.45);">
                  Entrar al club
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 8px 40px;text-align:center;">
                <p style="font-size:12px;color:${PRIMARY};line-height:1.6;margin:0;">
                  ¿El botón no funciona? Copia y pega este enlace en tu navegador:
                </p>
                <p style="font-size:11px;color:${MUTED};word-break:break-all;margin:8px 0 0 0;">${url}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 36px 40px;text-align:center;">
                <p style="font-size:11px;color:${MUTED};margin:0;">
                  Si no solicitaste este correo, puedes ignorarlo.
                </p>
                <p style="font-size:11px;font-style:italic;color:${MUTED};margin:10px 0 0 0;">
                  ${TAGLINE}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildMagicLinkText({ url, host }: { url: string; host: string }) {
  return `Moon Club de Lectura\n${TAGLINE}\n\nEntra a ${host} con este enlace mágico (válido 24h, un solo uso):\n${url}\n\nSi no solicitaste este correo, puedes ignorarlo.`;
}

export async function sendMagicLinkEmail({ email, url, from }: MagicLinkParams) {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) {
    throw new Error("Falta AUTH_RESEND_KEY en variables de entorno");
  }
  const resend = new Resend(apiKey);
  const host = new URL(url).host;

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `Tu enlace mágico para Moon Club de Lectura`,
    html: buildMagicLinkHtml({ url, host }),
    text: buildMagicLinkText({ url, host }),
  });

  if (error) {
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Recordatorio de reunión + saludo de cumpleaños (Paquete D)
// ─────────────────────────────────────────────────────────────────────────

interface MeetingReminderInfo {
  title: string;
  startsAt: Date;
  location?: string | null;
  meetingUrl?: string | null;
  isVirtual: boolean;
}

function formatMeetingWhen(date: Date) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function buildMeetingReminderHtml({ meeting }: { meeting: MeetingReminderInfo }) {
  const when = formatMeetingWhen(meeting.startsAt);
  const whereLabel = meeting.isVirtual ? "Enlace" : "Lugar";
  const whereValue = meeting.isVirtual
    ? meeting.meetingUrl ?? "Por confirmar"
    : meeting.location ?? "Por confirmar";

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:${BG};font-family:Inter,Helvetica,Arial,sans-serif;color:${FG};">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${BG};padding:48px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background:linear-gradient(180deg,${BORDER} 0%, ${CARD} 100%);border:1px solid rgba(198,159,213,0.25);border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:40px 40px 16px 40px;text-align:center;">
                <div style="font-family:'Brush Script MT', cursive;font-size:34px;color:${PRIMARY};letter-spacing:0.02em;">Moon</div>
                <div style="font-size:12px;letter-spacing:0.4em;color:${MUTED};text-transform:uppercase;margin-top:6px;">Club de Lectura</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 8px 40px;text-align:center;">
                <h1 style="font-size:22px;font-weight:600;margin:16px 0 8px 0;color:${FG};">Tu reunión es en menos de 24h</h1>
                <p style="font-size:16px;font-weight:600;color:${PRIMARY};margin:0 0 4px 0;">${meeting.title}</p>
                <p style="font-size:14px;line-height:1.6;color:${MUTED};margin:0 0 4px 0;text-transform:capitalize;">${when}</p>
                <p style="font-size:13px;line-height:1.6;color:${MUTED};margin:0 0 28px 0;">${whereLabel}: ${whereValue}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 36px 40px;text-align:center;">
                <p style="font-size:11px;font-style:italic;color:${MUTED};margin:0;">
                  ${TAGLINE}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildMeetingReminderText({ meeting }: { meeting: MeetingReminderInfo }) {
  const when = formatMeetingWhen(meeting.startsAt);
  const whereLabel = meeting.isVirtual ? "Enlace" : "Lugar";
  const whereValue = meeting.isVirtual
    ? meeting.meetingUrl ?? "Por confirmar"
    : meeting.location ?? "Por confirmar";

  return `Moon Club de Lectura\n${TAGLINE}\n\nTu reunión es en menos de 24h:\n"${meeting.title}"\n${when}\n${whereLabel}: ${whereValue}`;
}

export function buildBirthdayHtml({ name }: { name?: string | null }) {
  const greeting = name ? `¡Feliz cumpleaños, ${name}!` : "¡Feliz cumpleaños!";

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:${BG};font-family:Inter,Helvetica,Arial,sans-serif;color:${FG};">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${BG};padding:48px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background:linear-gradient(180deg,${BORDER} 0%, ${CARD} 100%);border:1px solid rgba(198,159,213,0.25);border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:40px 40px 16px 40px;text-align:center;">
                <div style="font-family:'Brush Script MT', cursive;font-size:34px;color:${PRIMARY};letter-spacing:0.02em;">Moon</div>
                <div style="font-size:12px;letter-spacing:0.4em;color:${MUTED};text-transform:uppercase;margin-top:6px;">Club de Lectura</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 8px 40px;text-align:center;">
                <h1 style="font-size:22px;font-weight:600;margin:16px 0 8px 0;color:${FG};">🎂 ${greeting}</h1>
                <p style="font-size:14px;line-height:1.6;color:${MUTED};margin:0 0 28px 0;">
                  Que tengas un día tan especial como tus lecturas favoritas. Todo el club te desea lo mejor.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 36px 40px;text-align:center;">
                <p style="font-size:11px;font-style:italic;color:${MUTED};margin:0;">
                  ${TAGLINE}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildBirthdayText({ name }: { name?: string | null }) {
  const greeting = name ? `¡Feliz cumpleaños, ${name}!` : "¡Feliz cumpleaños!";
  return `Moon Club de Lectura\n${TAGLINE}\n\n${greeting}\nQue tengas un día tan especial como tus lecturas favoritas. Todo el club te desea lo mejor.`;
}
