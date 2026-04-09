export const MCP_TOKEN_AUDIENCE = "mnm-mcp";

export function getMcpJwtSecret(): string {
  const secret = process.env.MNM_MCP_JWT_SECRET;
  if (secret) return secret;
  const deploymentMode = process.env.MNM_DEPLOYMENT_MODE ?? "local_trusted";
  if (deploymentMode === "local_trusted") return "mnm-mcp-dev-secret";
  throw new Error("MNM_MCP_JWT_SECRET is required in non-local deployments");
}
