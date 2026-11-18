import { NextResponse } from "next/server";
import { HttpError, apiHandler, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Full account export. Session secrets, one time codes and OAuth tokens are
 * deliberately excluded. Share tokens are excluded as well; the export keeps
 * only link metadata so a leaked export cannot be used to open shared files.
 */
export const GET = apiHandler(async () => {
  const user = await requireApiUser();
  const prisma = db();

  const [account, resumes, jobs, gaps, projects, coverLetters] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        headline: true,
        location: true,
        phone: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        oauthAccounts: { select: { provider: true, createdAt: true } },
      },
    }),
    prisma.resume.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: {
        versions: { orderBy: { createdAt: "asc" } },
        analyses: { orderBy: { createdAt: "asc" } },
        shareLinks: {
          orderBy: { createdAt: "asc" },
          select: { id: true, resumeVersionId: true, expiresAt: true, revokedAt: true, createdAt: true },
        },
      },
    }),
    prisma.job.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: {
        interviewPrep: { select: { questions: true, updatedAt: true } },
      },
    }),
    prisma.gapItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: { questions: true },
    }),
    prisma.plannedProject.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.coverLetter.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
  ]);

  if (!account) throw new HttpError(404, "Account not found.");

  const payload = {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    account,
    resumes,
    jobs,
    gaps,
    plannedProjects: projects,
    coverLetters,
    notes: [
      "Share link tokens are not included in this export.",
      "OAuth access and refresh tokens are not included in this export.",
      "Sign in codes are never stored in plain text and are not included.",
    ],
  };

  const filename = `resumeforge-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
