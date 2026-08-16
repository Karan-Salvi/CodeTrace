import asyncio
import subprocess


def _redact(text: str, token: str) -> str:
    return text.replace(token, "***REDACTED***") if token else text


async def clone_repository(github_url: str, token: str, dest_dir: str, timeout_seconds: int) -> str:
    # indexing.md: shallow clone via GitHub App installation token.
    # A file:// URL (used in tests) has no auth to inject; a real
    # https://github.com/... URL gets the token embedded as basic auth.
    clone_url = github_url
    if github_url.startswith("https://github.com/"):
        clone_url = github_url.replace("https://", f"https://x-access-token:{token}@", 1)

    try:
        # BullMQ docs: the worker must return control to the event loop
        # often enough to renew its job lock (default lockDuration 30s,
        # renewed at ~half that) or the job is marked stalled and
        # double-processed by another worker. subprocess.run blocks the
        # whole thread — for a real clone (not the near-instant local
        # fixtures in tests) this can easily exceed that window, so it
        # must run off-loop via to_thread, not called directly here.
        await asyncio.to_thread(
            subprocess.run,
            ["git", "clone", "--depth", "1", clone_url, dest_dir],
            check=True,
            capture_output=True,
            timeout=timeout_seconds,
        )
    except subprocess.CalledProcessError as exc:
        # security.md: "No raw tokens or secrets in logs." Both
        # CalledProcessError.__str__ (which renders the full argv,
        # including the credential-embedded clone_url) and its captured
        # stderr (git itself sometimes echoes the URL on failure) can
        # leak the installation token. This exception propagates all the
        # way to queue_consumer.py's failure handler, which logs str(exc)
        # and writes it to index_jobs.error_message in the database — so
        # the token must never survive into the message raised here.
        stderr = _redact(exc.stderr.decode("utf-8", errors="ignore") if exc.stderr else "", token)
        raise RuntimeError(
            f"git clone failed (exit {exc.returncode}): {stderr or 'no stderr output'}"
        ) from None
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"git clone timed out after {exc.timeout}s") from None

    # Get the SHA of the commit we just cloned. No token in this argv (cwd
    # is the local clone, no URL involved) so no redaction is needed here —
    # but it still needs the same RuntimeError-wrapping and timeout as the
    # clone step above: an empty repository (zero commits, a real GitHub
    # state) makes `rev-parse HEAD` fail, and without this the job would
    # crash on a raw, unhandled CalledProcessError instead of the
    # consistent failure message queue_consumer.py's handler expects.
    try:
        result = await asyncio.to_thread(
            subprocess.run,
            ["git", "rev-parse", "HEAD"],
            cwd=dest_dir,
            check=True,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(
            f"git rev-parse HEAD failed (exit {exc.returncode}): "
            f"{exc.stderr.strip() if exc.stderr else 'no stderr output'} "
            f"(repository may have zero commits)"
        ) from None
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"git rev-parse HEAD timed out after {exc.timeout}s") from None

    return result.stdout.strip()
