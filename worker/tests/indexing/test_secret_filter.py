from src.indexing.secret_filter import should_exclude


def test_excludes_env_files() -> None:
    assert should_exclude(".env", 100, 1_000_000) is True
    assert should_exclude(".env.production", 100, 1_000_000) is True

def test_excludes_key_and_pem_files() -> None:
    assert should_exclude("server.pem", 100, 1_000_000) is True
    assert should_exclude("private.key", 100, 1_000_000) is True

def test_excludes_secrets_and_credentials_files() -> None:
    assert should_exclude("secrets.yaml", 100, 1_000_000) is True
    assert should_exclude("credentials.json", 100, 1_000_000) is True

def test_excludes_ignored_directories() -> None:
    assert should_exclude("node_modules/foo/index.js", 100, 1_000_000) is True
    assert should_exclude(".git/HEAD", 100, 1_000_000) is True
    assert should_exclude("__pycache__/mod.pyc", 100, 1_000_000) is True
    assert should_exclude("venv/lib/site.py", 100, 1_000_000) is True

def test_excludes_oversized_files() -> None:
    assert should_exclude("big.js", 2_000_000, 1_000_000) is True

def test_allows_normal_source_file() -> None:
    assert should_exclude("src/index.ts", 500, 1_000_000) is False

def test_excludes_secret_files_with_backslash_separators() -> None:
    # Regression: full_index.py passes os.path.relpath output straight
    # through without normalizing separators (unlike incremental_index.py,
    # which does). os.path.relpath emits "\\" on Windows, and the secret
    # patterns anchor on "/" — a subdirectory ".env" would silently bypass
    # exclusion if should_exclude didn't normalize internally.
    assert should_exclude("config\\.env", 100, 1_000_000) is True
    assert should_exclude("secrets\\credentials.json", 100, 1_000_000) is True
    assert should_exclude("node_modules\\pkg\\index.js", 100, 1_000_000) is True

def test_excludes_secret_files_regardless_of_case() -> None:
    # security.md: enforced at ingestion — must hold on Linux (the actual
    # deployment target, deployment.md), a case-sensitive filesystem
    # where ".ENV" and "SECRETS.json" are different files from ".env"
    # and "secrets.json", not the same path resolved differently.
    assert should_exclude(".ENV", 100, 1_000_000) is True
    assert should_exclude(".Env.Production", 100, 1_000_000) is True
    assert should_exclude("SECRETS.YAML", 100, 1_000_000) is True
    assert should_exclude("Credentials.json", 100, 1_000_000) is True
    assert should_exclude("SERVER.PEM", 100, 1_000_000) is True
    assert should_exclude("Private.KEY", 100, 1_000_000) is True
