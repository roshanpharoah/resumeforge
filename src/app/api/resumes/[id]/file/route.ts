import { NextResponse } from "next/server";
import { apiHandler, requireApiUser } from "@/lib/api";
import { getFile, contentTypeFor } from "@/lib/storage";
import { getOwnedResume } from "@/lib/server-data";

export const runtime = "nodejs";

export const GET = apiHandler(async (_request: Request, { params }: { params: { id: string } }) => {
  const user = await requireApiUser();
  const resume = await getOwnedResume(user.id, params.id);
  if (!resume.originalFileKey) return NextResponse.json({ error: "No original file is stored for this resume." }, { status: 404 });
  const file = await getFile(resume.originalFileKey);
  const name = (resume.originalFileName || "resume").replace(/[^\w.\- ]+/g, "_");
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType || contentTypeFor(resume.originalFileKey),
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
