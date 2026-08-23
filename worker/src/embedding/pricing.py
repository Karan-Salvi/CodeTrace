# PLACEHOLDER RATE — not verified against Google's current billing page.
# Gemini's embedding API returns no token-count/usage field at all
# (confirmed against the installed google-genai SDK's own
# EmbedContentResponse type — only `embeddings` + an enterprise-only
# `metadata`), so this estimates tokens from character count using the
# ~4-characters-per-token approximation commonly used across the industry
# when no real tokenizer is available. This is inherently an estimate,
# not an exact figure the way QA/PR-review cost is (those read real
# token counts from the chat completion response) — the frontend labels
# it as such. Verify the rate itself against https://ai.google.dev/pricing
# before relying on it for real budgeting.
_CHARS_PER_TOKEN_ESTIMATE = 4
_RATE_USD_PER_1K_TOKENS = 0.00001  # gemini-embedding-001, placeholder


def estimate_embedding_cost_usd(char_count: int) -> float:
    if char_count <= 0:
        return 0.0
    estimated_tokens = char_count / _CHARS_PER_TOKEN_ESTIMATE
    return (estimated_tokens / 1000) * _RATE_USD_PER_1K_TOKENS
