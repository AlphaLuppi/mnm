export {};

declare global {
  namespace Express {
    interface Request {
      actor: {
        type: "board" | "agent" | "none";
        userId?: string;
        agentId?: string;
        companyId?: string;
        companyIds?: string[];
        isInstanceAdmin?: boolean;
        keyId?: string;
        runId?: string;
        source?: "local_implicit" | "session" | "agent_key" | "agent_jwt" | "none";
        /** For agent actors: the userId who created this agent (permissions inherit from creator) */
        creatorUserId?: string;
      };
    }
  }
}
