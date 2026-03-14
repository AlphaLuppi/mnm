import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

export const dockerAdapter: ServerAdapterModule = {
  type: "docker",
  execute,
  testEnvironment,
  models: [],
  agentConfigurationDoc: `# docker agent configuration

Adapter: docker

Runs agent commands inside an isolated Docker container with resource limits,
read-only rootfs, and no-new-privileges security flags.

Core fields:
- dockerImage (string, optional): Docker image to use (default: node:20-slim)
- env (object, optional): additional KEY=VALUE environment variables

Resource profiles are managed via container_profiles in the database.
`,
};
