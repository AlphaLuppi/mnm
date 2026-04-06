import { MarkdownProps } from "@mnm/shared";

import { MarkdownBody } from "../MarkdownBody";


export function MnmMarkdown({ props }: { props: typeof MarkdownProps._type }) {
  return <MarkdownBody className="text-sm">{props.content}</MarkdownBody>;
}
