import { Resend } from "resend";

interface MagicLinkParams {
  email: string;
  url: string;
  from: string;
}

const PRIMARY = "#9B73CE";
const BG = "#1B1230";
const FG = "#FAF7FF";

export function buildMagicLinkHtml({ url, host }: { url: string; host: string }) {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:${BG};font-family:Inter,Helvetica,Arial,sans-serif;color:${FG};">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${BG};padding:48px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background:linear-gradient(180deg,#241638 0%, #1B1230 100%);border:1px solid rgba(155,115,206,0.25);border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:40px 40px 16px 40px;text-align:center;">
                <div style="font-family:'Brush Script MT', cursive;font-size:34px;color:${PRIMARY};letter-spacing:0.02em;">Moon</div>
                <div style="font-size:12px;letter-spacing:0.4em;color:#CDB3F0;text-transform:uppercase;margin-top:6px;">Club de Lectura</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 8px 40px;text-align:center;">
                <h1 style="font-size:22px;font-weight:600;margin:16px 0 8px 0;color:${FG};">Tu enlace mágico</h1>
                <p style="font-size:14px;line-height:1.6;color:#E2D3F7;margin:0 0 28px 0;">
                  Toca el botón para entrar a <strong>${host}</strong>. El enlace caduca en 24 horas y solo funciona una vez.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 8px 40px;text-align:center;">
                <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#9B73CE,#653F94);color:#FAF7FF;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:999px;font-size:15px;letter-spacing:0.02em;box-shadow:0 8px 24px rgba(101,63,148,0.45);">
                  Entrar al club
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 8px 40px;text-align:center;">
                <p style="font-size:12px;color:#9B73CE;line-height:1.6;margin:0;">
                  ¿El botón no funciona? Copia y pega este enlace en tu navegador:
                </p>
                <p style="font-size:11px;color:#CDB3F0;word-break:break-all;margin:8px 0 0 0;">${url}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 36px 40px;text-align:center;">
                <p style="font-size:11px;color:#8054B8;margin:0;">
                  Si no solicitaste este correo, puedes ignorarlo.
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
  return `Moon Club de Lectura\n\nEntra a ${host} con este enlace mágico (válido 24h, un solo uso):\n${url}\n\nSi no solicitaste este correo, puedes ignorarlo.`;
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
