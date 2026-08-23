export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
}

// NOTE: These rates are placeholder numbers.
// The actual rates should be looked up from GCP documentation.
// Fallback is 1.5x the highest rate if the model name isn't found.
const RATES_USD_PER_1K_TOKENS: Record<string, { prompt: number; candidate: number }> = {
  "gemini-2.5-flash": { prompt: 0.000075, candidate: 0.0003 },
  "gemini-2.5-pro": { prompt: 0.00125, candidate: 0.005 },
};

const FALLBACK_RATE = { prompt: 0.001875, candidate: 0.0075 }; // 1.5x Pro

export function computeCostUsd(model: string, usage: TokenUsage): number {
  if (usage.promptTokens === 0 && usage.candidatesTokens === 0) {
    return 0;
  }
  
  let rate = RATES_USD_PER_1K_TOKENS[model];
  if (!rate) {
    console.warn(`Unrecognized model: ${model}, using fallback pricing`);
    rate = FALLBACK_RATE;
  }
  
  return (usage.promptTokens / 1000) * rate.prompt + (usage.candidatesTokens / 1000) * rate.candidate;
}
