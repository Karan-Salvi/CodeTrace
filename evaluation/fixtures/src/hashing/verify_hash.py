from .hasher import content_hash


def verify_hash(content: str, expected_hash: str) -> bool:
    return content_hash(content) == expected_hash
