import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

  const entries = await prisma.entry.findMany({ orderBy: { createdAt: "desc" } });

  const header = ["email", "lot", "code", "utilise", "email_envoye", "date"];
  const rows = entries.map((entry) =>
    [
      entry.email,
      entry.prizeLabel,
      entry.code,
      entry.redeemed ? "oui" : "non",
      entry.emailSent ? "oui" : "non",
      entry.createdAt.toISOString(),
    ]
      .map((value) => csvEscape(String(value)))
      .join(",")
  );

  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="participants-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
