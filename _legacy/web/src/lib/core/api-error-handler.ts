import { NextResponse } from "next/server";
import { MnMError } from "./errors";
import { getErrorMapping } from "./error-messages";

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof MnMError) {
    const mapping = getErrorMapping(err.code);
    const status = getHttpStatus(err.code);
    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: mapping.description,
          suggestion: mapping.suggestion,
          details: err.details,
        },
      },
      { status }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        suggestion: "Try again or report an issue.",
      },
    },
    { status: 500 }
  );
}

function getHttpStatus(code: string): number {
  switch (code) {
    case "AGENT_NOT_FOUND":
    case "SPEC_NOT_FOUND":
      return 404;
    case "LOCK_CONFLICT":
    case "AGENT_ALREADY_RUNNING":
      return 409;
    case "API_ERROR":
    case "SPAWN_FAILED":
    case "GIT_ERROR":
    case "DATABASE_ERROR":
      return 500;
    default:
      return 400;
  }
}
