from .hasher import content_hash


def store_chunk(content: str) -> dict:
    return {"hash": content_hash(content), "content": content}