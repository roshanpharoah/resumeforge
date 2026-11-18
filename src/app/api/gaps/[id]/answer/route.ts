import { HttpError, apiHandler, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { answerGapSchema } from "@/lib/requests";
import { factCheckProse } from "@/lib/fact-check";
import { getOwnedGap, getOwnedResume, saveResumeData, serializeGap } from "@/lib/server-data";
import { uid, type ResumeData } from "@/lib/types";
import type { AnswerGapResponse } from "@/lib/api-types";

export const runtime = "nodejs";

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const gap = await getOwnedGap(user.id, params.id);
  const body = answerGapSchema.parse(await request.json());
  const resume = await getOwnedResume(user.id, gap.resumeId);
  const data = resume.parsed as unknown as ResumeData;

  if (body.questionId) {
    const question = gap.questions.find((q) => q.id === body.questionId);
    if (!question) throw new HttpError(404, "That gap question was not found.");
    await db().gapQuestion.update({ where: { id: question.id }, data: { answer: body.answer } });
  } else if (gap.questions[0]) {
    await db().gapQuestion.update({ where: { id: gap.questions[0].id }, data: { answer: body.answer } });
  }

  let addedBulletId: string | undefined;
  if (body.addToResume) {
    const experience = body.experienceId
      ? data.experience.find((exp) => exp.id === body.experienceId)
      : data.experience.find((exp) => exp.current) ?? data.experience[0];
    if (!experience) {
      throw new HttpError(400, "Add a role to your resume first, then attach this evidence to it.");
    }
    const duplicate = experience.bullets.some((bullet) => bullet.text.trim().toLowerCase() === body.answer.trim().toLowerCase());
    if (!duplicate) {
      const bulletId = uid();
      experience.bullets.push({
        id: bulletId,
        text: body.answer.trim(),
        source: { type: "user_answer", ref: "Gap answer", quote: body.answer.trim() },
        verified: true,
        metricPlaceholder: false,
        keywords: [gap.skill],
      });
      addedBulletId = bulletId;
      await saveResumeData(resume.id, data);
    }
  }

  const factCheck = factCheckProse({
    text: body.answer,
    sources: [resume.rawText, body.answer],
    label: `${gap.skill} evidence`,
  });
  const fresh = await getOwnedGap(user.id, gap.id);
  const payload: AnswerGapResponse = { gap: serializeGap(fresh), data, addedBulletId, factCheck };
  return json(payload);
});
