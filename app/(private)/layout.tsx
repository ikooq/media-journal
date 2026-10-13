import { redirect } from "next/navigation";
import { bootstrap, DataError } from "@/lib/data/server";
import { isConfigured } from "@/lib/supabase/config";
import { ConfigurationRequired } from "@/components/configuration-required";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { AppShell } from "@/components/app-shell";
export const dynamic = "force-dynamic";
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isConfigured()) return <ConfigurationRequired />;
  try {
    const initial = await bootstrap();
    return (
      <WorkspaceProvider initial={initial}>
        <AppShell>{children}</AppShell>
      </WorkspaceProvider>
    );
  } catch (error) {
    if (error instanceof DataError && error.code === "UNAUTHENTICATED")
      redirect("/login");
    throw error;
  }
}
