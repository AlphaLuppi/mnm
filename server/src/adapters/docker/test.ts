import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import Docker from "dockerode";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  _ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];

  try {
    const docker = new Docker({ socketPath: "/var/run/docker.sock" });
    const version = await docker.version();

    checks.push({
      code: "docker_connection",
      level: "info",
      message: `Docker ${version.Version} (API ${version.ApiVersion}) on ${version.Os}/${version.Arch}`,
    });
  } catch (err: any) {
    checks.push({
      code: "docker_connection",
      level: "error",
      message: `Cannot connect to Docker daemon: ${err.message}`,
      hint: "Ensure Docker is running and /var/run/docker.sock is accessible.",
    });
  }

  return {
    adapterType: "docker",
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
