"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SpecRendererProps {
  content: string;
}

export function SpecRenderer({ content }: SpecRendererProps) {
  return (
    <ScrollArea className="h-full">
      <article className="prose prose-sm dark:prose-invert max-w-none p-4">
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {content}
        </Markdown>
      </article>
    </ScrollArea>
  );
}
