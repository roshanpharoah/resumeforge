import { HttpError, apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { acceptReframeSchema } from "@/lib/requests";
import { getOwnedGap, getOwnedResume, saveResumeData, serializeGap } from "@/lib/server-data";
import { uid, type GapOptions, type ResumeData } from "@/lib/types";
import type { AcceptReframeResponse } from "@/lib/api-types";

export const runtime = "nodejs";

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const gap = await getOwnedGap(user.id, params.id);
  const body = acceptReframeSchema.parse(await request.json());
  const options = gap.options as unknown as GapOptions;
  const option = options?.reframe?.[body.index];
  if (!option) throw new HttpError(400, "That reframe option is not available.");

  const resume = await getOwnedResume(user.id, gap.resumeId);
  const data = resume.parsed as unknown as ResumeData;
  const containing = data.experience.find((exp) => exp.bullets.some((bullet) => bullet.text.includes(option.source)));
  const experience = body.experienceId
    ? data.experience.find((exp) => exp.id === body.experienceId)
    : containing ?? data.experience.find((exp) => exp.current) ?? data.experience[0];
  if (!experience) throw new HttpError(400, "Add a role to your resume first, then use this reframe.");

  let addedBulletId: string | undefined;
  if (!experience.bullets.some((bullet) => bullet.text.trim().toLowerCase() === option.after.trim().toLowerCase())) {
    const bulletId = uid();
    experience.bullets.push({
      id: bulletId,
      text: option.after.trim(),
      source: { type: "user_text", ref: "Reframed from an existing bullet", quote: option.source },
      verified: true,
      metricPlaceholder: false,
      keywords: [gap.skill],
    });
    addedBulletId = bulletId;
    await saveResumeData(resume.id, data);
  }

  await db().gapItem.update({
    where: { id: gap.id },
    data: { status: "DONE", evidence: option.source },
  });

  const fresh = await getOwnedGap(user.id, gap.id);
  const payload: AcceptReframeResponse = { gap: serializeGap(fresh), data, addedBulletId };
  return json(payload);
});
