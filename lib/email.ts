import { Resend } from "resend";
import { siteConfig } from "@/config/site.config";

interface SendPrizeEmailParams {
  to: string;
  prizeLabel: string;
  prizeDescription?: string;
  code: string;
}

function buildHtmlTemplate({ to: _to, prizeLabel, prizeDescription, code }: SendPrizeEmailParams) {
  const { name, logoUrl, redeemInstructions } = siteConfig.business;
  const { cream, amber, coral, ink } = siteConfig.theme;

  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${escapeHtml(name)}" style="max-height:56px;margin-bottom:16px;" />`
    : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:${ink};margin-bottom:16px;">${escapeHtml(
        name
      )}</div>`;

  return `
  <div style="background-color:${cream};padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${amber}33;">
      <div style="background:linear-gradient(135deg, ${amber}, ${coral});padding:24px;text-align:center;">
        ${logoBlock}
        <p style="color:#ffffff;font-size:14px;margin:0;letter-spacing:0.04em;text-transform:uppercase;">Roue de la fortune</p>
      </div>
      <div style="padding:32px 24px;text-align:center;">
        <p style="color:${ink};font-size:16px;margin:0 0 8px;">Felicitations, vous avez gagne :</p>
        <p style="color:${coral};font-size:22px;font-weight:700;margin:0 0 16px;">${escapeHtml(prizeLabel)}</p>
        ${prizeDescription ? `<p style="color:${ink};font-size:14px;margin:0 0 24px;">${escapeHtml(prizeDescription)}</p>` : ""}
        <div style="background:${cream};border:2px dashed ${amber};border-radius:12px;padding:16px;margin:0 0 24px;">
          <p style="color:${ink}99;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px;">Votre code</p>
          <p style="color:${ink};font-size:28px;font-weight:700;letter-spacing:0.08em;margin:0;font-family:monospace;">${escapeHtml(code)}</p>
        </div>
        <p style="color:${ink};font-size:14px;margin:0;">${escapeHtml(redeemInstructions)}</p>
      </div>
    </div>
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

/**
 * Envoie l'e-mail de lot gagne. Retourne false en cas d'echec sans jamais
 * lever d'exception : un probleme d'envoi ne doit pas empecher le client de
 * voir son lot et son code a l'ecran.
 */
export async function sendPrizeEmail(params: SendPrizeEmailParams): Promise<boolean> {
  const client = getResendClient();
  const from = process.env.EMAIL_FROM;

  if (!client || !from) {
    console.warn(
      "[email] RESEND_API_KEY ou EMAIL_FROM manquant : e-mail non envoye (voir .env.example)."
    );
    return false;
  }

  try {
    const { error } = await client.emails.send({
      from,
      to: params.to,
      subject: `Votre lot chez ${siteConfig.business.name} 🎉`,
      html: buildHtmlTemplate(params),
    });

    if (error) {
      console.error("[email] Echec d'envoi Resend:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Exception lors de l'envoi:", err);
    return false;
  }
}
