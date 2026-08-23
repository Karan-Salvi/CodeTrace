def check_and_increment(store: dict, key: str, limit: int) -> bool:
    count = store.get(key, 0)
    if count >= limit:
        return False
    store[key] = count + 1
    return True