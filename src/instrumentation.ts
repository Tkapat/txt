export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmup } = await import("@/backend/model/registry");
    warmup().catch((error) => console.error("model warmup failed", error));
  }
}
