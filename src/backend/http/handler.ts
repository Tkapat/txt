import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./errors";

export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "bad_request",
            message: error.issues[0]?.message ?? "Invalid request",
          },
        },
        { status: 400 },
      );
    }
    console.error("detect failed:", (error as Error).name);
    return NextResponse.json(
      { error: { code: "internal", message: "Something went wrong." } },
      { status: 500 },
    );
  }
}
