export type LLMConfig = {
  apiKey: string
  model: string
}

export type LLMResponse = {
  content: string
  usage: {
    inputTokens: number
    outputTokens: number
  }
}
