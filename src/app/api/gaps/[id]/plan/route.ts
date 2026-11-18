import { HttpError, apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { plannedProjectSchema } from "@/lib/requests";
import { getOwnedGap, getOwnedResume, saveResumeData, serializeGap } from "@/lib/server-data";
import { uid, type GapOptions, type ResumeData } from "@/lib/types";
import type { PlannedProjectResponse } from "@/lib/api-types";

export const runtime = "nodejs";

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const gap = await getOwnedGap(user.id, params.id);
  const body = plannedProjectSchema.parse(await request.json());
  if (body.gapId !== gap.id) throw new HttpError(400, "Gap id mismatch.");
  const options = gap.options as unknown as GapOptions;
  const build = options?.build;
  if (!build) throw new HttpError(400, "No project plan is available for this gap.");

  const existing = await db().plannedProject.findFirst({ where: { gapItemId: gap.id } });
  const projectData = {
    userId: user.id,
    gapItemId: gap.id,
    title: build.title,
    scope: build.scope,
    stack: build.stack as unknown as object,
    plan: build.plan as unknown as object,
    repoStructure: build.repoStructure as unknown as object,
    status: body.status,
    link: body.link || null,
    completedAt: body.status === "DONE" ? new Date() : null,
  };
  if (existing) {
    await db().plannedProject.update({
      where: { id: existing.id },
      data: {
        status: body.status,
        link: body.link || existing.link,
        ...(body.status === "DONE" ? { completedAt: existing.completedAt ?? new Date() } : {}),
      },
    });
  } else {
    await db().plannedProject.create({ data: projectData as never });
  }

  await db().gapItem.update({
    where: { id: gap.id },
    data: { status: body.status === "DONE" ? "DONE" : "PLANNED", evidence: body.link || gap.evidence },
  });

  let data: ResumeData | undefined;
  let warning: string | undefined;
  if (body.addToResume) {
    if (body.status !== "DONE") {
      warning = "Project saved as a plan. It will not appear on your resume until you mark it done and add a public link.";
    } else if (!body.link) {
      throw new HttpError(400, "Add a public link before putting a completed project on your resume.");
    } else {
      const resume = await getOwnedResume(user.id, gap.resumeId);
      const resumeData = resume.parsed as unknown as ResumeData;
      const already = resumeData.projects.find((project) => project.name === build.title);
      if (!already) {
        resumeData.projects.push({
          id: uid(),
          name: build.title,
          role: "",
          description: build.scope,
          url: body.link,
          startDate: "",
          endDate: "",
          bullets: [],
          source: "user_answer",
          planned: false,
        });
        await saveResumeData(resume.id, resumeData);
      }
      data = resumeData;
    }
  }

  const fresh = await getOwnedGap(user.id, gap.id);
  const payload: PlannedProjectResponse & { warning?: string } = { gap: serializeGap(fresh), data, warning };
  return json(payload);
});
