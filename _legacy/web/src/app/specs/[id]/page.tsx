import fs from "node:fs";
import path from "node:path";
import { getMnMRoot } from "@/lib/core/paths";
import { notFound } from "next/navigation";
import matter from "gray-matter";
import * as specsRepo from "@/lib/db/repositories/specs";
import { SpecRenderer } from "@/components/specs/spec-renderer";
import { SpecFrontmatter } from "@/components/specs/spec-frontmatter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const dynamic = "force-dynamic";

const specTypeLabels: Record<string, string> = {
  product_brief: "Product Brief",
  prd: "PRD",
  architecture: "Architecture",
  story: "Stories",
  config: "Config",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SpecDetailPage({ params }: PageProps) {
  const { id } = await params;

  let spec: ReturnType<typeof specsRepo.findById>;
  try {
    spec = specsRepo.findById(id);
  } catch {
    notFound();
  }

  if (!spec) {
    notFound();
  }

  const repoRoot = getMnMRoot();
  const absPath = path.join(repoRoot, spec.filePath);

  let rawContent = "";
  try {
    rawContent = fs.readFileSync(absPath, "utf-8");
  } catch {
    return (
      <div className="p-4">
        <p className="text-destructive">
          File not found on disk: {spec.filePath}
        </p>
      </div>
    );
  }

  const { data: frontmatter, content: body } = matter(rawContent);
  const hasFrontmatter = Object.keys(frontmatter).length > 0;

  return (
    <div className="flex h-full flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/specs">Specs</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/specs">
              {specTypeLabels[spec.specType] ?? spec.specType}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{spec.title ?? spec.filePath}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {hasFrontmatter && <SpecFrontmatter data={frontmatter} />}

      <div className="min-h-0 flex-1 rounded-lg border">
        <SpecRenderer content={body} />
      </div>
    </div>
  );
}
