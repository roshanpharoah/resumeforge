import { apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { analysisFromRecord, getOwnedResume, serializeAnalysis } from "@/lib/server-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  await getOwnedResume(user.id, params.id);
  const jobId = new URL(request.url).searchParams.get("jobId");
  const row = await db().analysisReport.findFirst({
    where: { resumeId: params.id, ...(jobId ? { jobId } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return json({
    analysis: row ? analysisFromRecord(row) : null,
    report: row ? serializeAnalysis(row) : null,
  });
});
