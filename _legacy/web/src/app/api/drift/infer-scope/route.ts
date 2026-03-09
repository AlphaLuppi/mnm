import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import * as specRepo from "@/lib/db/repositories/specs";
import { getSuggestedScope, type InferredScope } from "@/lib/drift/scope-inference";
import { loadConfig } from "@/lib/core/config";

export interface InferScopeRequest {
  specId: string;
}

export interface InferScopeResponse extends InferredScope {
  specId: string;
  specTitle: string | null;
}

// POST /api/drift/infer-scope -- infer file scope from spec content
export async function POST(request: NextRequest) {
  try {
    const body: InferScopeRequest = await request.json();
    const { specId } = body;

    if (!specId) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "specId is required" } },
        { status: 400 }
      );
    }

    // Get spec from DB
    const spec = specRepo.findById(specId);
    if (!spec) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Spec not found" } },
        { status: 404 }
      );
    }

    // Read spec content from disk
    const config = loadConfig();
    let specContent: string;
    try {
      specContent = readFileSync(join(config.repositoryPath, spec.filePath), "utf-8");
    } catch {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Spec file not found on disk" } },
        { status: 404 }
      );
    }

    // Infer scope
    const inferred = getSuggestedScope(specContent);

    const response: InferScopeResponse = {
      specId,
      specTitle: spec.title,
      ...inferred,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Scope inference error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Scope inference failed" } },
      { status: 500 }
    );
  }
}
