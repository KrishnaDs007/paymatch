import { redirect } from "next/navigation";
import { AppHeader } from "@/app/AppHeader";
import { getCurrentUser } from "@/lib/auth";
import { getImportBatches } from "@/lib/dashboard";
import { getMaxImportBatches } from "@/lib/import-limits";
import { BatchList } from "@/app/dashboard/BatchList";
import { ImportForm } from "./ImportForm";

export default async function ImportPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const batches = await getImportBatches(user.id);
  const maxImportBatches = getMaxImportBatches();

  return (
    <main className="app-page">
      <AppHeader
        eyebrow="Import"
        title="CSV import"
        subtitle="Upload orders and payments to create a reconciled batch."
        user={user}
        activePage="import"
      />
      <ImportForm
        currentBatchCount={batches.length}
        maxImportBatches={maxImportBatches}
      />
      {batches.length > 0 ? (
        <BatchList batches={batches} activeBatchId="" />
      ) : null}
    </main>
  );
}
