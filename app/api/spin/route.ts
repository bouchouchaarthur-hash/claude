import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pickWeightedPrize, generatePrizeCode } from "@/lib/prizes";
import { sendPrizeEmail } from "@/lib/email";
import { siteConfig } from "@/config/site.config";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CODE_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  let body: { email?: unknown; consent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Requete invalide." }, { status: 400 });
  }

  const rawEmail = typeof body.email === "string" ? body.email : "";
  const email = rawEmail.trim().toLowerCase();
  const consent = body.consent === true;

  if (!consent) {
    return NextResponse.json(
      { error: "consent_required", message: "Merci d'accepter la politique de confidentialite." },
      { status: 400 }
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: "invalid_email", message: "Adresse e-mail invalide." },
      { status: 400 }
    );
  }

  // --- Anti-triche : un seul tour valide par adresse e-mail -----------------
  const existing = await prisma.entry.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      {
        error: "already_played",
        message: "Tu as deja tente ta chance avec cette adresse e-mail !",
      },
      { status: 409 }
    );
  }

  const { prize } = pickWeightedPrize(siteConfig.prizes);

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const userAgent = req.headers.get("user-agent");

  let entry = null;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !entry; attempt++) {
    const code = generatePrizeCode();
    try {
      entry = await prisma.entry.create({
        data: {
          email,
          prizeId: prize.id,
          prizeLabel: prize.label,
          code,
          ipAddress,
          userAgent,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = (err.meta?.target as string[] | undefined) ?? [];
        if (target.includes("email")) {
          // Course concurrente : deux requetes simultanees pour le meme e-mail.
          return NextResponse.json(
            {
              error: "already_played",
              message: "Tu as deja tente ta chance avec cette adresse e-mail !",
            },
            { status: 409 }
          );
        }
        // Collision sur le code : on reessaie avec un nouveau code genere.
        continue;
      }
      throw err;
    }
  }

  if (!entry) {
    return NextResponse.json(
      { error: "server_error", message: "Impossible de generer un code, reessayez." },
      { status: 500 }
    );
  }

  const emailSent = await sendPrizeEmail({
    to: email,
    prizeLabel: prize.label,
    prizeDescription: prize.description,
    code: entry.code,
  });

  if (emailSent !== entry.emailSent) {
    await prisma.entry.update({ where: { id: entry.id }, data: { emailSent } });
  }

  return NextResponse.json({
    prizeId: prize.id,
    prizeLabel: prize.label,
    code: entry.code,
    emailSent,
  });
}
