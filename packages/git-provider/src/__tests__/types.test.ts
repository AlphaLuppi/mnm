import { describe, it, expectTypeOf } from "vitest";
import type {
  GitProvider,
  FetchBlobArgs,
  ListTagsArgs,
  Tag,
  ResolveRefArgs,
  PathExistsArgs,
  CommitFileArgs,
  CommitFileResult,
} from "../types.js";

describe("GitProvider interface", () => {
  it("exposes five methods with the expected shapes", () => {
    expectTypeOf<GitProvider["fetchBlob"]>().parameters.toEqualTypeOf<[FetchBlobArgs]>();
    expectTypeOf<GitProvider["fetchBlob"]>().returns.toEqualTypeOf<Promise<string>>();

    expectTypeOf<GitProvider["listTags"]>().parameters.toEqualTypeOf<[ListTagsArgs?]>();
    expectTypeOf<GitProvider["listTags"]>().returns.toEqualTypeOf<Promise<Tag[]>>();

    expectTypeOf<GitProvider["resolveRef"]>().parameters.toEqualTypeOf<[ResolveRefArgs]>();
    expectTypeOf<GitProvider["resolveRef"]>().returns.toEqualTypeOf<Promise<string>>();

    expectTypeOf<GitProvider["pathExists"]>().parameters.toEqualTypeOf<[PathExistsArgs]>();
    expectTypeOf<GitProvider["pathExists"]>().returns.toEqualTypeOf<Promise<boolean>>();

    expectTypeOf<GitProvider["commitFile"]>().parameters.toEqualTypeOf<[CommitFileArgs]>();
    expectTypeOf<GitProvider["commitFile"]>().returns.toEqualTypeOf<Promise<CommitFileResult>>();
  });

  it("Tag is { name, sha }", () => {
    expectTypeOf<Tag>().toEqualTypeOf<{ name: string; sha: string }>();
  });

  it("CommitFileArgs requires author identity", () => {
    expectTypeOf<CommitFileArgs>().toMatchTypeOf<{
      path: string;
      content: string;
      message: string;
      branch: string;
      authorName: string;
      authorEmail: string;
    }>();
  });

  it("CommitFileResult exposes the created commit sha", () => {
    expectTypeOf<CommitFileResult>().toEqualTypeOf<{ sha: string }>();
  });
});
