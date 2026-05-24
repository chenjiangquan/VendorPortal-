import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { approveEditRequest } from "@/lib/product-request-actions";

export async function POST(request: Request) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;
  const body = await request.json().catch(() => ({}));
  const requestIds = Array.isArray(body.requestIds) ? body.requestIds.filter((id: unknown): id is string => typeof id === "string") : [];
  if (!requestIds.length) return NextResponse.json({ error: "Select at least one edit request." }, { status: 400 });

  let successCount = 0;
  const failedItems: { id: string; title?: string; error: string }[] = [];
  for (const id of requestIds) {
    try {
      await approveEditRequest(ctx, id);
      successCount += 1;
    } catch (error) {
      failedItems.push({ id, error: error instanceof Error ? error.message : "Approval failed." });
    }
  }

  return NextResponse.json({ successCount, failedCount: failedItems.length, failedItems });
}
