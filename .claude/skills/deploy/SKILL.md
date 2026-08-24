---
name: deploy
description: Publish this static site (johndlr.com) to production. Use when the user asks to deploy, publish, push to production/live, or sync the site to the server.
---

# Deploy johndlr.com to production

This is a small static site — no build step, no server-side code, no
dependencies beyond a Google Fonts `@import` in `css/styles.css`. The
tracked file set is:

```
index.html
css/styles.css
js/main.js
assets/favicon.svg
robots.txt
.well-known/security.txt
.well-known/pgp-key.txt
```

**No production host is configured in this repo.** The README says to
point `johndlr.com` at whatever static host is chosen (Netlify, Vercel,
GitHub Pages, S3 + CloudFront, a plain VPS, etc.) and serve this
directory as the site root. If/when a real host is set up, replace this
section with the actual sync steps (rsync target, deploy hook, CLI
command — whichever applies) and how to verify a deploy landed. Until
then, treat "deploy" as: confirm `git status`/`git log` show what the
user intends to ship, then hand off to whatever the chosen host's
publish mechanism is.

## Content-Security-Policy maintenance

The CSP ships as a `<meta http-equiv="Content-Security-Policy">` tag in
`index.html` (there's no server config in this repo to attach a real
header to). Current policy:

```
default-src 'none';
script-src 'self';
style-src 'self' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com;
img-src 'self';
connect-src 'none';
base-uri 'none';
form-action 'none';
object-src 'none';
require-trusted-types-for 'script';
upgrade-insecure-requests
```

Why each piece is there: `default-src 'none'` denies everything not
explicitly allowed. `script-src 'self'` permits only `js/main.js` — no
inline scripts, no third-party JS. `style-src`/`font-src` allow exactly
the Google Fonts stylesheet and the font files it pulls from
`fonts.gstatic.com` (the only external resource this site loads).
`img-src 'self'` covers the favicon and any future local images.
`connect-src 'none'`, `base-uri 'none'`, `form-action 'none'`, and
`object-src 'none'` are all currently unused surface area, closed off —
there are no fetches, no `<base>` tag, and no `<form>` on the page.
`require-trusted-types-for 'script'` blocks DOM-XSS sinks
(`innerHTML`, etc.) even though `js/main.js` doesn't use any today; it's
free hardening as long as that stays true, and is ignored (not broken)
by browsers that don't support Trusted Types.

**Known limitation**: a `<meta>` CSP cannot carry `frame-ancestors`,
`sandbox`, or any `report-to`/`report-uri` directive — browsers silently
ignore those inside a meta tag per spec. There's a comment above the tag
in `index.html` noting this. If this site ever moves behind a server or
CDN you control, add the real HTTP header there instead (or in addition)
and include `frame-ancestors 'none'` plus reporting.

**This is fragile the same way any hash-free strict CSP with `'self'`
sources is**: if a future edit adds an inline `<script>`/`<style>` block
or a `style="..."` attribute to `index.html`, it will be silently
blocked by the browser (no console-visible server error, just dropped
execution) unless `script-src`/`style-src` are loosened or the content
is moved into `js/main.js` / `css/styles.css` instead — prefer moving it
out over loosening the policy.

**Verify like an outside visitor, not from local assumptions.** Serve
the site locally and check for `securitypolicyviolation` events in a
real browser rather than just eyeballing the policy string — a page that
"looks right" can still silently drop something the policy blocks. One
way to do this headlessly:

```bash
npx --yes serve -l 8934 . &
# then drive a real Chrome instance (headless is fine) to
# http://localhost:8934/, enable the Log/Page CDP domains, and watch for
# console entries with source "security" or matching /content security
# policy/i — that's what actually caught issues here, not just reading
# the directive list.
```

## security.txt maintenance

`.well-known/security.txt` (RFC 9116) is PGP clear-signed for
`david+security@mrai.dev`. Key: RSA 4096, sign-only, generated
2026-08-24, expires **2027-08-24**. The public half is committed at
`.well-known/pgp-key.txt`. **The private key is not in this repo and
never will be** — it was generated in an isolated, temporary
`GNUPGHOME`, exported once, handed directly to the user as a file, and
every local trace (the `GNUPGHOME`, the exported `.asc`, the key-gen
params file) was deleted immediately after. Only the user has it.

Fields (CRLF line endings per RFC 9116, before signing):

```
Contact: mailto:david+security@mrai.dev
Expires: 2027-08-24T23:59:59.000Z
Preferred-Languages: en
Canonical: https://johndlr.com/.well-known/security.txt
```

To re-sign with a new `Expires` date before 2027-08-24 (or sooner, if
the fields themselves need to change): the user imports their own stored
copy of the private key (`gpg --import <path>`), then re-clearsign the
updated field list:

```bash
gpg --local-user david+security@mrai.dev --clearsign --digest-algo SHA512 \
  -o .well-known/security.txt /path/to/updated-fields.txt
```

If the key needs to change entirely (compromise, or the user wants a
different key), generate a fresh key pair the same way this one was
made: isolated temp `GNUPGHOME` (use a short path like `/tmp/gh.XXXXXX`
— a long path breaks the gpg-agent socket, which has a length limit),
`%no-protection` batch key-gen so it can be handed over passphrase-free,
export the public half to `.well-known/pgp-key.txt`, clearsign
`.well-known/security.txt`, hand the private key to the user as a file,
then delete every local trace. Don't reuse a key whose private half
might have left the user's control.

**Verify like an outside visitor after any change** — this is the only
real proof; verifying against your own keyring (which already trusts a
key you just generated or fetched) proves nothing about what a stranger
would see:

```bash
FRESH_GNUPGHOME=$(mktemp -d /tmp/fgh.XXXXXX)
curl -s https://johndlr.com/.well-known/pgp-key.txt | GNUPGHOME="$FRESH_GNUPGHOME" gpg --import
curl -s https://johndlr.com/.well-known/security.txt > /tmp/fetched-security.txt
GNUPGHOME="$FRESH_GNUPGHOME" gpg --verify /tmp/fetched-security.txt
rm -rf "$FRESH_GNUPGHOME" /tmp/fetched-security.txt
```

Expect `gpg: Good signature from "johndlr Security <david+security@mrai.dev>"`.
The accompanying `WARNING: The key's User ID is not certified with a
trusted signature!` is normal and expected for a self-published,
uncertified key — it's not an error.

(Note: this verification step assumes the site is actually being served
at `https://johndlr.com/` — until a production host is wired up, run it
against wherever the files are actually being served instead.)
