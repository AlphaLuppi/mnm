// Shared Docker client — auto-detects Windows named pipe vs Unix socket
import Docker from "dockerode";
import { logger } from "../middleware/logger.js";

let _instance: Docker | null = null;

export function getDockerClient(): Docker {
  if (_instance) return _instance;

  const isWindows = process.platform === "win32";

  if (process.env.DOCKER_HOST) {
    // Explicit DOCKER_HOST takes priority
    logger.info(`Docker: using DOCKER_HOST=${process.env.DOCKER_HOST}`);
    _instance = new Docker({ host: process.env.DOCKER_HOST });
  } else if (isWindows) {
    // Windows: use named pipe
    _instance = new Docker({ socketPath: "//./pipe/docker_engine" });
  } else {
    // Linux/macOS: use Unix socket
    _instance = new Docker({ socketPath: "/var/run/docker.sock" });
  }

  return _instance;
}
