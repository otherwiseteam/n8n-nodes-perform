# Publishing `n8n-nodes-perform` to npm

## Why this is not just `npm publish`

Two constraints collide, and the order of operations below exists to satisfy both.

**1. n8n requires provenance from CI.** Since 1 May 2026, n8n will not verify a community node
published from a local machine. Verified nodes must be published by GitHub Actions with an npm
**provenance attestation** tying the tarball to a specific public repo and commit.

**2. npm killed token-based CI publishing on 2FA accounts.** npm invalidated granular access tokens
with write access that bypass two-factor authentication, in response to the 2026 supply-chain
attacks. A CI publish using `NPM_TOKEN` on a 2FA-enabled account now fails with:

```
npm error code EOTP
npm error This operation requires a one-time password from your authenticator.
```

The replacement is **Trusted Publishing (OIDC)**: GitHub Actions proves its identity to npm
directly, no token exists to leak, and provenance is attached automatically.

**3. Trusted publishing has a chicken-and-egg problem.** You configure a trusted publisher in a
*package's* settings, and a package that has never been published has no settings page. So the very
first publish cannot use trusted publishing.

### The resolution

Claim the name with one local publish, then switch to trusted publishing for every real release:

| Version | How | Provenance | Purpose |
|---|---|---|---|
| `0.0.1` | local `npm publish --otp=…` | none | creates the package so its settings page exists |
| `0.1.0` onwards | GitHub Release → Actions | automatic | the releases people install; what you submit for verification |

`0.0.1` is a real, working build, just an early version number. Submit `0.1.0` for verification, not
`0.0.1`. Optionally `npm deprecate n8n-nodes-perform@0.0.1 "placeholder release"` afterwards to
steer people away from it.

---

## Step 1: npm account and 2FA

1. Sign in at [npmjs.com](https://www.npmjs.com) with the account that should own the package.
   Publish rights follow the account, so use a company-controlled one.
2. **Account → Two-Factor Authentication → Enable**, mode *Authorization and Publishing*.
3. Optionally create an organisation (free for public packages) so the package is not tied to a
   personal login. You can also publish first and transfer the package to the org later.

**You do not need to create an npm token.** That is the whole point of the flow below.

## Step 2: claim the name with one local publish

This is the only local publish you will ever do for this package.

```bash
npm login                 # opens a browser
npm whoami                # confirm
npm install --ignore-scripts
npm run build && npm test && npm run lint
npm run scan              # confirm n8n would accept the package
npm publish --access public
```

npm will prompt for your authenticator code, or pass it directly:

```bash
npm publish --access public --otp=123456
```

Confirm it landed:

```bash
npm view n8n-nodes-perform version    # 0.0.1
```

## Step 3: register the trusted publisher

Now that the package exists, go to
**npmjs.com → n8n-nodes-perform → Settings → Trusted Publisher → GitHub Actions** and enter:

| Field | Value |
|---|---|
| Organization or user | `otherwiseteam` |
| Repository | `n8n-nodes-perform` |
| Workflow filename | `publish.yml` |
| Environment | leave blank |

The workflow filename must match exactly. It is part of what npm verifies.

## Step 4: release 0.1.0 through Actions

```bash
npm version minor          # 0.0.1 -> 0.1.0, commits and tags
git push --follow-tags
```

Then create a GitHub Release on the new tag (**Releases → Draft a new release → choose `v0.1.0` →
Publish release**). That triggers `.github/workflows/publish.yml`.

The workflow already has everything trusted publishing needs:

- `permissions: id-token: write` mints the OIDC token
- `npm install -g npm@latest` because trusted publishing requires npm CLI **11.5.1+**, and Node 22
  ships npm 10
- `npm publish --access public` with **no** `--provenance` flag and **no** `NODE_AUTH_TOKEN`;
  trusted publishing handles both

## Step 5: verify the publish

```bash
npm view n8n-nodes-perform
```

Open the npm package page and confirm a **Provenance** section naming the repo and commit. If it is
missing, verification will be rejected. Check in this order:

1. The trusted publisher entry names the right repo *and* workflow filename.
2. The workflow run shows `id-token: write`.
3. The npm CLI in the run is 11.5.1 or later.

## Step 6: submit for verification

Verification is what makes the node installable on **n8n Cloud** and lists it in n8n's directory.

1. `npm run scan`: both legs must pass.
2. Confirm `0.1.0` has a provenance attestation.
3. Submit at the [n8n Creator Portal](https://creators.n8n.io/nodes).

## Installing it meanwhile

Self-hosted n8n can install it as soon as it is on npm, verified or not:

**Settings → Community Nodes → Install** → `n8n-nodes-perform`

Unverified packages may need these on the instance:

```bash
N8N_COMMUNITY_PACKAGES_ENABLED=true
N8N_UNVERIFIED_PACKAGES_ENABLED=true
```

The second one's default is changing to `false` in a future n8n version, so set it explicitly.

---

## Verification readiness

Run `npm run scan` to reproduce n8n's real gate offline. It lints the source checkout and the built
output, the same two legs n8n checks. Everything below is already satisfied:

| Requirement | Status |
|---|---|
| Name starts with `n8n-nodes-` | yes |
| Keyword `n8n-community-node-package` | yes |
| **Zero runtime dependencies** | yes, `dependencies: {}` |
| MIT licence | yes, required by n8n; a copyleft licence is rejected outright |
| TypeScript, strict | yes |
| One third-party service per package | yes |
| No env-var or filesystem access in shipped code | yes |
| English-only node interface | yes |
| Distinct light/dark icons, nodes and credential | yes |
| `repository` / `homepage` / `bugs` | yes |
| Passes the scan, both legs | yes |

## Things to know

**Publishing is permanent.** You cannot republish a version number. Unpublishing is possible only
within 72 hours and is discouraged.

**The author email is public and permanent, and n8n requires it.** Removing it fails the gate with
`@n8n/community-nodes/valid-author` ("The author field must include a non-empty email"), so the
choice is *which* address, not whether to have one. The package uses `connect@otherwise.co.il`.

**Keep the licence MIT.** n8n enforces it as a hard error
(`community-package-json-license-not-default`).

**Two nodes, one credential.** `package.json` lists both `Perform` and `Perform Trigger` under
`n8n.nodes`. Both are loaded from `dist/`, so `npm run build` must run before `npm publish`
(`prepublishOnly` does this).

**One known deviation.** n8n suggests scaffolding nodes with their `n8n-node` CLI; this package was
built by hand. It passes the automated gate, but a reviewer could comment on structure. The fix would
be mechanical: scaffold fresh and move `nodes/` and `credentials/` across.

## Later releases

```bash
npm version patch          # or minor / major
git push --follow-tags
```

Then draft a Release on the new tag. Each release publishes via trusted publishing with provenance.
