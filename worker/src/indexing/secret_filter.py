import re

# security.md: enforced at ingestion, before parsing — never a
# downstream filter that could be bypassed. re.IGNORECASE matters here:
# the worker's actual deployment target (deployment.md) is Linux, a
# case-sensitive filesystem, so a checked-in `.ENV` or `SECRETS.json`
# must not silently bypass this filter just because it isn't lowercase.
SECRET_FILE_PATTERNS = [
    re.compile(r"(^|/)\.env(\..+)?$", re.IGNORECASE),
    re.compile(r"\.pem$", re.IGNORECASE),
    re.compile(r"\.key$", re.IGNORECASE),
    re.compile(r"(^|/)secrets\.", re.IGNORECASE),
    re.compile(r"(^|/)credentials\.", re.IGNORECASE),
]

IGNORED_DIR_SEGMENTS = {
    "node_modules", ".git", "dist", "build", "coverage",
    ".next", "venv", "__pycache__",
}


def should_exclude(path: str, size_bytes: int, max_size_bytes: int) -> bool:
    if size_bytes > max_size_bytes:
        return True

    # Normalize once here, not per-caller — os.path.relpath emits
    # backslash separators on Windows, and a caller that forgets to
    # normalize before calling in would silently bypass the secret-file
    # patterns below (they all anchor on "/"), even though this same
    # function's dir-segment check already normalizes.
    normalized = path.replace("\\", "/")

    segments = normalized.split("/")
    if any(seg in IGNORED_DIR_SEGMENTS for seg in segments):
        return True

    return any(pattern.search(normalized) for pattern in SECRET_FILE_PATTERNS)
