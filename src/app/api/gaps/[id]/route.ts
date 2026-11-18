import { apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { updateGapSchema } from "@/lib/requests";
import { getOwnedGap, serializeGap } from "@/lib/server-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const gap = await getOwnedGap(user.id, params.id);
  const body = updateGapSchema.parse(await request.json());

  await db().gapItem.update({
    where: { id: gap.id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.evidence !== undefined ? { evidence: body.evidence || null } : {}),
    },
  });
  if (body.status === "DONE" && gap.plannedProject && !gap.plannedProject.completedAt) {
    await db().plannedProject.update({ where: { id: gap.plannedProject.id }, data: { status: "DONE", completedAt: new Date() } });
  }
  const fresh = await getOwnedGap(user.id, gap.id);
  return json({ gap: serializeGap(fresh) });
});
