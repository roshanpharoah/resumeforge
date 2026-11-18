import { apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import type { DashboardDto } from "@/lib/serializers";
import {
  analysisFromRecord,
  applicationFromRow,
  getOwnedResume,
  listResumes,
  serializeResumeDetail,
} from "@/lib/server-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const user = await requireApiUser();
  const prisma = db();
  const [resumes, jobs] = await Promise.all([
    listResumes(user.id),
    prisma.job.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { versions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, label: true } } },
    }),
  ]);

  const activeSummary = resumes.find((r) => r.isPrimary) ?? resumes[0] ?? null;
  let activeResume = null;
  let latest = null;
  let scoreHistory: { date: string; score: number }[] = [];
  if (activeSummary) {
    const row = await getOwnedResume(user.id, activeSummary.id);
    activeResume = serializeResumeDetail(row);
    const recent = await prisma.analysisReport.findMany({
      where: { resumeId: activeSummary.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    if (recent[0]) latest = analysisFromRecord(recent[0]);
    scoreHistory = recent
      .slice()
      .reverse()
      .map((r) => ({ date: r.createdAt.toISOString().slice(0, 10), score: r.score }));
  }

  const [gapCount, plannedProjects] = await Promise.all([
    prisma.gapItem.count({ where: { userId: user.id, status: { in: ["OPEN", "PLANNED"] } } }),
    prisma.plannedProject.count({ where: { userId: user.id, status: { in: ["PLANNED", "IN_PROGRESS"] } } }),
  ]);

  const payload: DashboardDto = {
    resumes,
    activeResume,
    jobs: jobs.map((job) => applicationFromRow(job)),
    latestAnalysis: latest,
    topFixes: latest ? latest.issues.slice(0, 5) : [],
    gapCount,
    plannedProjects,
    scoreHistory,
  };
  return json(payload);
});
