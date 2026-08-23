import hashlib


def content_hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()