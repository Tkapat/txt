import { connection } from "next/server";
import { handle } from "@/backend/http/handler";
import { loadJson, type ModelMeta } from "@/backend/model/meta";
import { modelsInstalled } from "@/backend/model/registry";

async function version(name: string): Promise<string | null> {
  try {
    return (await loadJson<ModelMeta>(name)).version;
  } catch {
    return null;
  }
}

export async function GET() {
  await connection();
  return handle(async () => ({
    ok: true,
    models: {
      review: await version("review-meta"),
      document: await version("document-meta"),
    },
    available: await modelsInstalled(),
  }));
}
