import Link from "next/link";
import { CsvImporter } from "@/components/admin/CsvImporter";
import { requireStaff } from "@/lib/auth/session";

export const metadata = { title: "Import clients" };

export default async function ImportPage() {
  await requireStaff(["owner"]);
  return (
    <>
      <header className="top">
        <div><h1>Import clients</h1><small>From a CSV export of your current booking system</small></div>
        <Link className="btn btn-ghost btn-sm" href="/admin/clients">‹ All clients</Link>
      </header>
      <div className="body" style={{ maxWidth: 900 }}><CsvImporter /></div>
    </>
  );
}
