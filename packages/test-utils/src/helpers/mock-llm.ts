/**
 * A minimal mock LLM provider for testing agent flows without real API calls.
 */
export interface MockLlmProvider {
  /** Generate a completion from a prompt. Returns canned responses. */
  complete: (prompt: string) => Promise<string>;
  /** Generate a chat completion from messages. Returns canned responses. */
  chat: (messages: Array<{ role: string; content: string }>) => Promise<string>;
  /** Track how many times each method was called. */
  callCounts: { complete: number; chat: number };
  /** The responses that were returned, in order. */
  responses: string[];
  /** Override the default response for subsequent calls. */
  setResponse: (response: string) => void;
  /** Queue multiple responses to be returned in order. */
  queueResponses: (responses: string[]) => void;
}

/**
 * Create a mock LLM provider that returns deterministic responses.
 *
 * @param defaultResponse - The default response text (defaults to "Mock LLM response")
 */
export function createMockLlmProvider(defaultResponse = "Mock LLM response"): MockLlmProvider {
  let currentDefault = defaultResponse;
  const responseQueue: string[] = [];
  const responses: string[] = [];
  const callCounts = { complete: 0, chat: 0 };

  function getNextResponse(): string {
    const response = responseQueue.length > 0
      ? responseQueue.shift()!
      : currentDefault;
    responses.push(response);
    return response;
  }

  return {
    complete: async (_prompt: string) => {
      callCounts.complete++;
      return getNextResponse();
    },
    chat: async (_messages: Array<{ role: string; content: string }>) => {
      callCounts.chat++;
      return getNextResponse();
    },
    callCounts,
    responses,
    setResponse: (response: string) => {
      currentDefault = response;
    },
    queueResponses: (newResponses: string[]) => {
      responseQueue.push(...newResponses);
    },
  };
}
