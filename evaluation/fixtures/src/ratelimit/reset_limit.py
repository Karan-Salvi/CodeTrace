def reset_limit(user_id: str, store: dict) -> None:
    store.pop(user_id, None)
