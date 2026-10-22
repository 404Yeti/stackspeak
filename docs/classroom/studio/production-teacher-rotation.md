# AUD-78 — Production teacher password rotation, 2026-10-22

**Current release:** the separate Production identities are approved and configured;
see [Production runbook](production-release.md). Earlier pending-decision text is historical.

Completed under the owner's explicit password-rotation approval. No authentication
architecture change, account replacement or password file was needed. This is an
authentication-only Production deployment; Classroom Studio PR11 is not merged.

## Procedure verified before rotation

Classroom is a single-owner password gate, not a database-backed user account.
`auth.ts` verifies server-only `CLASSROOM_PASSWORD_HASH` using scrypt N65536/r8/p2,
64-byte output, a random16-byte hexadecimal salt (passed as a string), and constant-
time comparison. Passwords are bounded and scrypt concurrency is limited. Sessions
are signed over the origin, password hash and payload, so changing the hash revokes
existing sessions without replacing `CLASSROOM_SESSION_SECRET` or the login flow.

All10 existing authentication tests passed, including password verification,
session tampering/expiry, hash/key rotation, origin/CSRF, authorization and logout.
Windows Credential Manager synthetic write/read/delete passed before any mutation.
The previous immutable Production deployment was READY and retained:
`dpl_6MEB4U75WxBzXYYTSHgdiYFcUDaZ`, code15ca578. The official Instant Rollback
procedure was reviewed; no rollback drill or disruptive traffic swap was run.

## Applied and verified

- Generated48 secure random bytes, base64url encoded, independent of other secrets.
- Stored plaintext only in the current Windows user's Credential Manager entry
  `StackSpeak/Classroom/Production/Teacher`; roundtrip verified privately. No
  plaintext password file, command argument, chat, log, Git or PR value.
- Derived hash privately and cross-checked with Node's exact existing scrypt settings.
- Updated only existing sensitive Production `CLASSROOM_PASSWORD_HASH`.
  Vercel holds the hash, never the plaintext password.
- Preserved Production session secret, origin, private source guides and every
  other existing environment variable. All Preview environment metadata unchanged.
- Redeployed existing main15ca578, with no Studio/application code changes:
  `dpl_EcPQjoayATtdRCTUVwcasSkf6YWX`, READY,
  https://stackspeak-8uknaafr0-robert-leybas-projects.vercel.app .
  Production alias remains https://stackspeak.vercel.app .
- Browser login using the vault credential passed. Cookie remained Secure,
  HttpOnly, SameSite Strict, path/classroom. Authorized guide200, anonymous401,
  wrong password rejection and cross-origin403 passed; logout removed the cookie.
- All3 existing public student lessons200. The private source slug renders the
  existing not-found UI without a student workspace; stable main's known soft404
  still returns200. This predates rotation; PR11's genuine404 fix remains pending.
- Production Daily Challenge Read→Explain→Fix passed with Run Code OFF, no runner
  requests/iframe. No backend/CORS/WAF/runner/AUD-60 modifications.

## Private owner handoff

A public helper (no embedded password) lives at
`C:\Users\Lenovo\AppData\Local\StackSpeak\ClassroomCredential.ps1`.
In Windows PowerShell, run:

```powershell
& "$env:LOCALAPPDATA\StackSpeak\ClassroomCredential.ps1" -Action Copy
```

This retrieves the Windows-user-protected vault entry and copies it to the local
clipboard without displaying it. Paste into your password manager or the existing
Classroom login and clear the clipboard afterward. No manual password recovery,
password-file creation or interaction was needed to rotate or test authentication.
Automation can privately capture the same vault entry for the pending Studio
Production smoke test; it must never forward that value to tool output.

## Rollback and pending release

For a critical failure in this password-only deployment, Instant Rollback to the
retained previous Production deployment restores its immutable runtime environment
and old authentication behavior. This does not recover the forgotten password or
restore the project's old unreadable sensitive hash setting. Future builds retain
the newly configured hash; distinguish project settings from active deployment.
The new credential remains safely in the vault for a forward fix.

For the eventual Studio release, use the now-verified password-rotation deployment
`dpl_EcPQjoayATtdRCTUVwcasSkf6YWX` as the immediate stable rollback target. This
preserves the newly known password while reverting Studio code, without SQL rollback
or resurrecting snapshots. Keep that deployment and its aliases available.

Vercel authentication access is restored. The remaining separate release decision
is unchanged: new Production database passwords cannot coexist with Preview's
passwords on the same two PostgreSQL identities. The proposed minimal two Production
login identities and exact username-allowlist support still await approval. Existing
database roles/passwords and Preview configuration were not changed. No PR merge,
lesson import, additional migration or Studio Production cutover occurred here.
