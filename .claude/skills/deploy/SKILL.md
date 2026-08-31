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

## Production host

Production is a Virtualmin-managed box reachable over SSH as `ns1`
(`~/.ssh/config` → `ns1.digicrew.com`, user `ubuntu`, `sudo -n` is
passwordless there — confirmed live 2026-08-24). Files live in
`/home/johndlr/public_html`, owned by `johndlr:johndlr`. This host also
serves other, unrelated tenants (`zcurity.com` and others) — don't
assume something found on the box belongs to johndlr.com without
checking; see the TLSA note below for a case where that mattered.

Do not skip the dry run and post-deploy verification steps — this
writes directly to the live production host.

### 1. Confirm what you're shipping

```bash
git status --short
git log --oneline -5
```

Don't deploy uncommitted or unintended changes without checking with the
user first.

### 2. Dry-run, then real sync to a staging path (no root needed)

```bash
rsync -avzn --exclude='.git' --exclude='.claude' ./ ns1:/tmp/johndlr_deploy/
```

Read the output. As of 2026-08-24 the full tracked tree is exactly 14
files: `README.md`, `index.html`, `robots.txt`, `sitemap.xml`,
`.well-known/security.txt`, `.well-known/pgp-key.txt`,
`assets/favicon.svg`, `css/styles.css`, `js/main.js`. Nothing else.
There is no WordPress, no PHP, no per-page subdirectories — if a dry run
ever shows more than that, stop and investigate before proceeding. Once
it looks right:

```bash
rsync -avz --exclude='.git' --exclude='.claude' ./ ns1:/tmp/johndlr_deploy/
```

### 3. Move into place as root, fix ownership, clean up staging

```bash
ssh -o BatchMode=yes ns1 'sudo -n bash -s' <<'REMOTE'
set -e
DEST=/home/johndlr/public_html
SRC=/tmp/johndlr_deploy
rsync -a "$SRC/" "$DEST/"
chown -R johndlr:johndlr "$DEST"
rm -rf "$SRC"
REMOTE
```

No `--delete` is used, so nothing gets removed server-side that isn't
also removed from this repo — if a stray file ever shows up on the
server that isn't tracked here, flag it and ask before deleting rather
than assuming `--delete` is safe.

### 4. Verify like an outside visitor

```bash
for p in / /sitemap.xml /.well-known/security.txt /.well-known/pgp-key.txt /robots.txt; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://johndlr.com${p}")
  echo "$p -> $code"
done
curl -sI https://johndlr.com/ | grep -i "content-security-policy\|strict-transport"
```

Report the verification results back to the user — don't just say
"deployed."

## Content-Security-Policy maintenance

The CSP is set in **two places** that must be kept in sync:

1. A `<meta http-equiv="Content-Security-Policy">` tag in `index.html`
   (so the policy still applies if this repo is ever served from
   somewhere other than the current host).
2. `Header always set Content-Security-Policy "..."` inside
   `johndlr.com.conf`'s `:443` `VirtualHost` block on `ns1`
   (`/etc/apache2/sites-available/johndlr.com.conf`). This is the
   authoritative one in production — it's also the only one that can
   carry `frame-ancestors` (see below).

**This is deliberately scoped per-vhost, not in the shared
`/etc/apache2/conf-available/security.conf`.** That shared file applies
to every tenant on this host and sets `ServerTokens Prod`,
`ServerSignature Off`, `TraceEnable Off`,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, and — as of 2026-08-30 —
`Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"`
host-wide (see the HSTS note below). It has no CSP of its own. Don't add
johndlr.com-specific policy (especially the exact source list here,
which is meaningless for other tenants' content) into that shared file.

Current policy — identical in both places except the header also
carries `frame-ancestors 'none'`, which a `<meta>` tag can't express:

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
frame-ancestors 'none';
require-trusted-types-for 'script';
upgrade-insecure-requests
```

To ship a change to the header on the server:

```bash
CSP="default-src 'none'; script-src 'self'; ..."   # full value, single line
echo "$CSP" > /tmp/csp_value.txt
scp /tmp/csp_value.txt ns1:/tmp/csp_value.txt && rm /tmp/csp_value.txt

ssh -o BatchMode=yes ns1 'sudo -n bash -s' <<'REMOTE'
set -e
CONF=/etc/apache2/sites-available/johndlr.com.conf
cp "$CONF" "$CONF.bak-$(date +%Y%m%d%H%M%S)"
python3 - "$CONF" /tmp/csp_value.txt <<'PYEOF'
import re, sys
conf_path, csp_path = sys.argv[1], sys.argv[2]
text = open(conf_path).read()
csp_value = open(csp_path).read().strip()
pattern = re.compile(r'Header always set Content-Security-Policy "[^"]*"')
if not pattern.search(text):
    sys.exit("existing CSP line not found")
open(conf_path, "w").write(pattern.sub(f'Header always set Content-Security-Policy "{csp_value}"', text, count=1))
PYEOF
rm -f /tmp/csp_value.txt
apachectl configtest
systemctl reload apache2
REMOTE
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

**Verify like an outside visitor, not from local assumptions.** A 200
status and a header that "looks right" prove nothing about whether a
browser actually accepted the policy. Drive a real Chrome instance
(headless is fine) to `https://johndlr.com/`, enable the CDP `Log` and
`Page` domains, and watch for console entries with `source: "security"`
or matching `/content security policy/i`. This is what actually caught
issues in the past — checking headers/hashes alone did not. If you're
testing a change before it's live, serve the repo locally
(`npx --yes serve -l 8934 .`) and point the same check at
`http://localhost:8934/` first, but still re-check the live site after
deploying since the header comes from a separate config file that can
drift out of sync with `index.html`.

## HSTS (Strict-Transport-Security)

As of **2026-08-30**, HSTS is set **host-wide** on `ns1`, not per-vhost:

```
Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" "expr=%{HTTPS} == 'on'"
```

lives in the shared `/etc/apache2/conf-available/security.conf` (loaded
via `conf-enabled/` before any vhost), so every tenant domain on the box
inherits the same value. Before this, all ~25 vhosts each carried their
own copy with inconsistent casing (`includeSubDomains` vs
`includeSubdomains`); every one of those per-vhost lines was stripped
from every enabled config the same day, with no exceptions left.
Backups: shared file at `security.conf.bak-20260830185853` (pre-HSTS)
and `security.conf.bak-20260830190813` (pre-`expr=` guard), all vhost
copies under `/root/hsts-vhost-strip-20260830185914/` on `ns1`.

The `"expr=%{HTTPS} == 'on'"` guard is required: without it the
server-scope directive also fires on the `:80` redirect vhosts, so
plain-HTTP `301`/`302` responses carry an HSTS header. Browsers ignore
HSTS over HTTP per RFC 6797, but scanners flag it ("Unnecessary HSTS
header over HTTP"). With the guard, HTTP responses have no HSTS and
HTTPS responses (including error pages) still do.

- **No enabled vhost sets HSTS itself anymore** — don't re-add one to
  `johndlr.com.conf` or any other; the shared config covers them all.
  The `Header always set Content-Security-Policy` line is now the only
  `Header` directive left in johndlr.com's `:443` block.
- `max-age=63072000` is 2 years; `preload` is a hard commitment (getting
  a domain *off* the browser preload list is slow). Don't add a new
  domain to this host that isn't fully HTTPS-ready on every subdomain.
- Any edit to this value must go in the shared file and be verified
  against several tenant domains (`curl -sI https://<domain>/ | grep -i
  strict-transport`), not just johndlr.com — check a 404 response too,
  since `always` is what makes it appear on error pages, and check a
  plain-`http://` response has *no* HSTS header (the `expr=` guard).

## security.txt maintenance

`.well-known/security.txt` (RFC 9116) is PGP clear-signed for
`david+security@mrai.dev`. Key: RSA 4096, sign-only, fingerprint
`D10E 948E 4C4C 0F5E F7DB EB95 8883 0988 9AB7 3177`, generated
2026-08-31, expires **2028-08-30**. The public half is committed at
`.well-known/pgp-key.txt`. **The private key is not in this repo and
never will be** — it was generated in an isolated, temporary
`GNUPGHOME`, exported once, handed directly to the user as a file, and
every local trace (the `GNUPGHOME`, the exported `.asc`, the key-gen
params file) was deleted immediately after. Only the user has it.

This key replaced the original 2026-08-24 key (fingerprint
`FA45 B5FB CAD0 90F2 E937 C41E ACF0 ECA1 6685 7F6D`) on 2026-08-30. The
old key's private half may still exist on the user's machine; it is no
longer published, so anything signed by it should be treated as
untrusted from that date.

Fields (CRLF line endings per RFC 9116, before signing):

```
Contact: mailto:david+security@mrai.dev
Expires: 2027-08-30T23:59:59.000Z
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
uncertified key — it's not an error. Confirmed working live against
`https://johndlr.com/` on 2026-08-24, and again after the key rotation
on 2026-08-30.

## TLSA (DANE) sync

johndlr.com publishes a `_443._tcp` TLSA record (`3 0 1` — DANE-EE, full
cert, SHA-256), pinned to the domain's Let's Encrypt/Virtualmin-managed
certificate. DANE only provides real security if the TLSA hash matches
whatever certificate is actually being served, which breaks silently (no
error, just rejected connections for DANE-validating clients) whenever
the cert renews with a new key.

**This is handled automatically** via a daily cron job on `ns1`
(`crontab -l -u root`, added 2026-08-24, `22 15 * * *`, right next to
the existing `zcurity.com` TLSA-sync job and the `resign.pl`
DNSSEC-refresh job at `34 15 * * *`):

```
22 15 * * * /usr/sbin/virtualmin modify-dns --domain johndlr.com --sync-tlsa >> /var/log/johndlr-tlsa-sync.log 2>&1
```

`virtualmin modify-dns --sync-tlsa` is Virtualmin's own first-party
feature (`virtualmin help modify-dns`) — it re-signs the zone (via the
same DNSSEC key material as everything else on this nameserver) and
restarts DNS for the domain. **Prefer this over any hand-rolled
zone-file edit + `dnssec-signzone` script** — reproducing Virtualmin's
signing/serial-bump logic by hand is exactly the kind of thing that's
easy to get subtly wrong on a shared nameserver serving other domains
too.

The first manual run (2026-08-24) actually changed the zone file (serial
bumped to `2026082403`) rather than being a no-op — this domain had
never had a TLSA sync run before, so the record it already had matched
the current cert by coincidence rather than by being kept in sync.
Confirmed afterward with `named-checkzone` (`DNSSEC signed` / `OK`) and
by comparing the TLSA hash against the live cert directly. Log rotated
weekly, 8 weeks kept, via `/etc/logrotate.d/johndlr-tlsa-sync` (mirrors
the `zcurity.com` config, including a pre-existing, host-wide
`logrotate -d` warning about `/var/log`'s group-writable permissions —
that's not specific to this file and wasn't introduced by this change).

**Root's crontab is shared** — every domain on this host has its cron
in the same file. The job above was appended after backing up the prior
crontab (`/root/root-crontab-backup-<timestamp>.txt`); if you ever need
to edit it again, back it up the same way first (`crontab -l -u root >
backup-file`) rather than assuming a raw edit won't clobber an unrelated
entry.

To verify TLSA is actually in sync with the live cert at any time:

```bash
dig +short TLSA _443._tcp.johndlr.com
echo | openssl s_client -connect johndlr.com:443 -servername johndlr.com 2>/dev/null \
  | openssl x509 -outform DER 2>/dev/null | openssl dgst -sha256
# the hex after "3 0 1" in the TLSA record should match the openssl dgst output
```
