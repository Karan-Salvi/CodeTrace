# Auth

## Goal

GitHub-only identity, no password to store or leak — `security.md` already
states this as a decision; this doc covers the mechanics that were
otherwise only implied by `backend/src/core/middlewares/auth.middleware.ts`
and `backend/src/modules/auth/*` existing in the file tree.

## Login flow

```
User clicks "Sign in with GitHub"
        v
Redirect to GitHub OAuth authorize URL (scope: read:user, user:email)
        v
GitHub redirects back with ?code=
        v
Backend exchanges code -> GitHub access token (server-side only, never sent to frontend)
        v
Fetch GitHub user profile -> upsert `users` row (database.md) keyed by github_id
        v
Issue a signed session token (JWT, short-lived access + refresh pair)
        v
Set as httpOnly, Secure, SameSite=Lax cookie -> frontend never touches the token directly
```

This OAuth login is separate from the **GitHub App installation** flow
(`security.md`, `database.md: repository_installations`) — OAuth
identifies *the user*, the GitHub App installation grants *repository
access*. A user can be logged in with zero repositories installed.

## Session validation

`auth.middleware.ts` verifies the JWT signature + expiry on every request,
attaches `req.user`, and rejects (401) otherwise — no session lookup
against the database on the hot path (stateless JWT), except for token
revocation below.

## Token expiry and revocation

- Access token: short-lived (~15 min), refreshed via the refresh token
  without re-hitting GitHub OAuth.
- Refresh token: longer-lived, stored hashed in the `sessions` table
  (`database.md`) — one row per device/login, so signing in on a second
  device doesn't kill the first session. Revocation is per-session
  (logout), or all of a user's sessions at once ("log out everywhere",
  or GitHub App uninstall cascading to session invalidation) — rather
  than tokens being valid until natural expiry no matter what.
- GitHub OAuth token itself (used for API calls on the user's behalf, not
  for session auth) is stored encrypted at rest, same handling as GitHub
  App installation tokens (`security.md`).

## Authorization (every request, not just login)

Every repository-scoped route re-checks that `req.user` owns (or has
access to) the `repository_id` in the request — enforced at the query
layer per `security.md`, not assumed from a valid session alone. A valid
session proves *who*, not *what they can touch*.
