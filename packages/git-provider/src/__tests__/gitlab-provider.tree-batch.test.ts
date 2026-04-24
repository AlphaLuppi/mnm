import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitlabProvider } from "../gitlab-provider.js";

const BASE = "https://gitlab.example.com";
const PROJECT = "123";
const TOKEN = "glpat-test";

function makeProvider() {
  return new GitlabProvider({
    providerId: `gitlab:${PROJECT}`,
    baseUrl: BASE,
    projectId: PROJECT,
    token: TOKEN,
  });
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitlabProvider.fetchTree", () => {
  it("GETs /repository/tree with ref/path/recursive params and the bot token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [
        { id: "aaa", type: "blob", path: "hello/workflow.json", mode: "100644" },
        { id: "bbb", type: "tree", path: "hello/gates", mode: "040000" },
      ]),
    );
    const provider = makeProvider();
    const entries = await provider.fetchTree({
      ref: "v1.0.0",
      subtree: "hello",
      recursive: true,
    });
    expect(entries).toEqual([
      { path: "hello/workflow.json", type: "blob", sha: "aaa", size: null },
      { path: "hello/gates", type: "tree", sha: "bbb", size: null },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    const s = String(url);
    expect(s).toContain(`${BASE}/api/v4/projects/${PROJECT}/repository/tree?`);
    expect(s).toContain("ref=v1.0.0");
    expect(s).toContain("path=hello");
    expect(s).toContain("recursive=true");
    expect(s).toContain("per_page=100");
    expect(s).toContain("pagination=keyset");
    expect((init as RequestInit).headers).toMatchObject({
      "PRIVATE-TOKEN": TOKEN,
    });
  });

  it("paginates via x-next-page until empty", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          [{ id: "a", type: "blob", path: "a.md", mode: "100644" }],
          { "x-next-page": "2" },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          [{ id: "b", type: "blob", path: "b.md", mode: "100644" }],
          { "x-next-page": "" },
        ),
      );
    const provider = makeProvider();
    const entries = await provider.fetchTree({ ref: "main", recursive: true });
    expect(entries.map((e) => e.path)).toEqual(["a.md", "b.md"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("omits path when no subtree is given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));
    const provider = makeProvider();
    await provider.fetchTree({ ref: "main" });
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain("path=");
    expect(String(url)).toContain("recursive=false");
  });
});

describe("GitlabProvider.commitMultipleFiles", () => {
  it("resolves create vs update via a single tree fetch and POSTs the batch", async () => {
    // First call: fetchTree for existing paths on the branch.
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, [
          { id: "exist", type: "blob", path: "hello/workflow.json", mode: "100644" },
          { id: "exist2", type: "blob", path: "hello/old.md", mode: "100644" },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse(201, { id: "newsha" }));

    const provider = makeProvider();
    const result = await provider.commitMultipleFiles({
      branch: "main",
      commitMessage: "batch",
      authorName: "Tom",
      authorEmail: "tom@example.com",
      actions: [
        { path: "hello/workflow.json", content: "updated" }, // update
        { path: "hello/new.md", content: "brand new" }, // create
        { path: "hello/old.md", delete: true }, // delete
      ],
    });

    expect(result).toEqual({ sha: "newsha" });

    // Second call is the commits POST.
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toBe(
      `${BASE}/api/v4/projects/${PROJECT}/repository/commits`,
    );
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toEqual({
      branch: "main",
      commit_message: "batch",
      author_name: "Tom",
      author_email: "tom@example.com",
      actions: [
        {
          action: "update",
          file_path: "hello/workflow.json",
          content: "updated",
        },
        {
          action: "create",
          file_path: "hello/new.md",
          content: "brand new",
        },
        {
          action: "delete",
          file_path: "hello/old.md",
        },
      ],
    });
  });

  it("treats every non-delete action as create when the branch tree 404s", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(jsonResponse(201, { id: "bootstrapsha" }));

    const provider = makeProvider();
    await provider.commitMultipleFiles({
      branch: "new-branch",
      commitMessage: "seed",
      authorName: "Tom",
      authorEmail: "tom@example.com",
      actions: [{ path: "hello/workflow.json", content: "x" }],
    });

    const [, init] = fetchMock.mock.calls[1]!;
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.actions[0].action).toBe("create");
  });

  it("throws conflict on 400 from the commits endpoint", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(
        jsonResponse(400, { message: "A file with this name already exists" }),
      );
    const provider = makeProvider();
    await expect(
      provider.commitMultipleFiles({
        branch: "main",
        commitMessage: "x",
        authorName: "Tom",
        authorEmail: "tom@example.com",
        actions: [{ path: "x.md", content: "x" }],
      }),
    ).rejects.toMatchObject({ code: "conflict", status: 400 });
  });
});
