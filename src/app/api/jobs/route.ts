import { Prisma, type JobStatus } from "@prisma/client";
import { apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { createJobSchema } from "@/lib/requests";
import { extractJd } from "@/lib/keywords";
import { serializeJobSummary } from "@/lib/server-data";
import type { CreateJobResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: Request) => {
  const user = await requireApiUser();
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const validStatus = ["SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED"].includes(status ?? "") ? (status as JobStatus) : null;
  const jobs = await db().job.findMany({
    where: { userId: user.id, ...(validStatus ? { status: validStatus } : {}) },
    orderBy: { updatedAt: "desc" },
  });
  return json({ jobs: jobs.map(serializeJobSummary) });
});

export const POST = apiHandler(async (request: Request) => {
  const user = await requireApiUser();
  const body = createJobSchema.parse(await request.json());
  const extracted = extractJd(body.jdText, body.title, body.company);
  const status = body.status ?? "SAVED";
  const job = await db().job.create({
    data: {
      userId: user.id,
      company: body.company,
      title: body.title,
      jdText: body.jdText,
      url: body.url || null,
      location: body.location || null,
      status,
      statusUpdatedAt: new Date(),
      appliedAt: status === "APPLIED" ? new Date() : null,
      extracted: extracted as unknown as Prisma.InputJsonValue,
      notes: body.notes || null,
    },
  });
  const payload: CreateJobResponse = { job: { ...serializeJobSummary(job), jdText: job.jdText, extracted, notes: job.notes, salaryMin: null, salaryMax: null, currency: "USD", versions: [], gaps: [], coverLetters: [], interviewPrep: null } };
  return json(payload, { status: 201 });
});
