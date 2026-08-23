def estimate_cost(tokens: int, rate_per_1k: float) -> float:
    if tokens <= 0:
        return 0.0
    return (tokens / 1000) * rate_per_1k