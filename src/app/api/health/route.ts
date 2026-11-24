import { connection } from "next/server";
import { handle } from "@/backend/http/handler";
import { getModelMeta, modelsStatus } from "@/backend/model/registry";
import type { ModelKey } from "@/shared/types";

async function version(key: ModelKey): Promise<string | null> {
  try {
    return (await getModelMeta(key)).version;
  } catch {
    return null;
  }
}

export async function GET() {
  await connection();
  return handle(async () => {
    const [review, document, ready] = await Promise.all([
      version("review"),
      version("document"),
      modelsStatus(),
    ]);
    return {
      ok: true,
      models: { review, document },
      available: ready.review || ready.document,
      ready,
    };
  });
}
