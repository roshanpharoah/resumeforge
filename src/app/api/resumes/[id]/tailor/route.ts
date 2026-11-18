import { HttpError, apiHandler, json, requireApiUser } from "@/lib/api";
import { tailorSchema } from "@/lib/requests";
import { tailorWithAi } from "@/lib/ai";
import { getOwnedResume, resolveJd } from "@/lib/server-data";
import type { TailorResponse } from "@/lib/api-types";

export const runtime = "nodejs";
export const maxDuration = 90;

export const POST = apiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const body = tailorSchema.parse(await request.json());
  const resume = await getOwnedResume(user.id, params.id);
  const { jd, rawJd } = await resolveJd({ userId: user.id, jobId: body.jobId, jdText: body.jdText, title: body.title, company: body.company });
  if (!jd) throw new HttpError(400, "Add a job description before tailoring.");

  const base = resume.parsed as unknown as TailorResponse["base"];
  const result = await tailorWithAi(base, jd, rawJd, body.useLlm, body.answers ?? []);
  const payload: TailorResponse = { result, base, design: resume.design as unknown as TailorResponse["design"] };
  return json(payload);
});
