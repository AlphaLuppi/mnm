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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitlabProvider.commitFile", () => {
  it("POSTs /repository/commits with a single action + user-stamped author", async () => {
    // Gate file exists? -> 404 means "create".
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 })) // HEAD files/<path>?ref=branch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "newsha123" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );

    const provider = makeProvider();
    const result = await provider.commitFile({
      path: "hello-world/workflow.json",
      content: '{"name":"hello"}',
      message: "add hello-world workflow",
      branch: "main",
      authorName: "Tom User",
      authorEmail: "tom@example.com",
    });
    expect(result).toEqual({ sha: "newsha123" });

    // Second call is the commits POST.
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(String(url)).toBe(
      `${BASE}/api/v4/projects/${PROJECT}/repository/commits`,
    );
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({
      "PRIVATE-TOKEN": TOKEN,
      "Content-Type": "application/json",
    });
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toEqual({
      branch: "main",
      commit_message: "add hello-world workflow",
      author_name: "Tom User",
      author_email: "tom@example.com",
      actions: [
        {
          action: "create",
          file_path: "hello-world/workflow.json",
          content: '{"name":"hello"}',
        },
      ],
    });
  });

  it("uses action=update when the file already exists on the branch", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 })) // HEAD -> exists
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "sha2" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );

    const provider = makeProvider();
    await provider.commitFile({
      path: "README.md",
      content: "updated",
      message: "bump",
      branch: "main",
      authorName: "Tom",
      authorEmail: "tom@example.com",
    });

    const [, init] = fetchMock.mock.calls[1]!;
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.actions[0].action).toBe("update");
  });

  it("throws conflict on 400 from GitLab commits endpoint", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "A file with this name already exists" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      );

    const provider = makeProvider();
    await expect(
      provider.commitFile({
        path: "README.md",
        content: "x",
        message: "x",
        branch: "main",
        authorName: "Tom",
        authorEmail: "tom@example.com",
      }),
    ).rejects.toMatchObject({ code: "conflict", status: 400 });
  });
});
