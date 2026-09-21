import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { siteConfig } from "@/config/site.config";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/admin/login");
  }

  const entries = await prisma.entry.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="admin-page">
      <div className="admin-header">
        <div>
          <h1>Dashboard - {siteConfig.business.name}</h1>
          <p>{entries.length} participation(s) enregistree(s)</p>
        </div>
        <div className="admin-header-actions">
          <a className="admin-export-link" href="/api/admin/export">
            Exporter en CSV
          </a>
          <LogoutButton />
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>E-mail</th>
              <th>Lot</th>
              <th>Code</th>
              <th>E-mail envoye</th>
              <th>Utilise</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.createdAt.toLocaleString("fr-FR")}</td>
                <td>{entry.email}</td>
                <td>{entry.prizeLabel}</td>
                <td className="admin-code">{entry.code}</td>
                <td>{entry.emailSent ? "✅" : "❌"}</td>
                <td>{entry.redeemed ? "✅" : "—"}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="admin-empty">
                  Aucune participation pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
