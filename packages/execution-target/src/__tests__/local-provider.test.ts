import { describe, it, expect } from "vitest";
import { LocalProvider } from "../local-provider.js";

// Use a portable "echo" via node -e to avoid Windows shell quoting issues
// (shell:false is enforced by LocalProvider, so node is the safest CLI).
const NODE = process.execPath;

describe("LocalProvider", () => {
  it("identifies as the local driver", () => {
    const p = new LocalProvider("env-local-1");
    expect(p.driver).toBe("local");
    expect(p.environmentId).toBe("env-local-1");
  });

  it("setup() returns provider metadata without doing I/O", async () => {
    const p = new LocalProvider("env-local-2");
    const state = await p.setup();
    expect(state.data?.driver).toBe("local");
    // `host` is process.platform — must match real platform
    expect(state.data?.host).toBe(process.platform);
  });

  it("run() captures stdout from a node script", async () => {
    const p = new LocalProvider("env-local-3");
    await p.setup();
    const result = await p.run({
      command: NODE,
      args: ["-e", "process.stdout.write('hello-world')"],
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello-world");
    expect(result.stderr).toBe("");
    expect(result.timedOut).toBe(false);
    expect(result.aborted).toBe(false);
    await p.teardown();
  });

  it("run() captures stderr and non-zero exit code", async () => {
    const p = new LocalProvider("env-local-4");
    await p.setup();
    const result = await p.run({
      command: NODE,
      args: ["-e", "process.stderr.write('boom'); process.exit(7)"],
    });
    expect(result.exitCode).toBe(7);
    expect(result.stderr).toBe("boom");
    expect(result.stdout).toBe("");
    await p.teardown();
  });

  it("run() streams stdout chunks via onStdout", async () => {
    const p = new LocalProvider("env-local-5");
    await p.setup();
    const chunks: string[] = [];
    const result = await p.run({
      command: NODE,
      args: ["-e", "process.stdout.write('streamed-bytes')"],
      onStdout: (c) => chunks.push(c),
    });
    expect(result.exitCode).toBe(0);
    expect(chunks.join("")).toBe("streamed-bytes");
  });

  it("run() honors a soft timeout and reports timedOut=true", async () => {
    const p = new LocalProvider("env-local-6");
    await p.setup();
    const result = await p.run({
      command: NODE,
      args: ["-e", "setInterval(() => {}, 1000)"],
      timeoutMs: 200,
    });
    expect(result.timedOut).toBe(true);
    // exitCode is null when killed by signal
    expect(result.exitCode).toBeNull();
  });

  it("run() merges custom env on top of process.env", async () => {
    const p = new LocalProvider("env-local-7", {
      defaultEnv: { MNM_TEST_DEFAULT: "default-value" },
    });
    await p.setup();
    const result = await p.run({
      command: NODE,
      args: [
        "-e",
        "process.stdout.write([process.env.MNM_TEST_DEFAULT, process.env.MNM_TEST_RUN].join('|'))",
      ],
      env: { MNM_TEST_RUN: "run-value" },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("default-value|run-value");
  });

  it("teardown() is idempotent", async () => {
    const p = new LocalProvider("env-local-8");
    await p.setup();
    await p.teardown();
    await p.teardown(); // must not throw
    expect(true).toBe(true);
  });
});
