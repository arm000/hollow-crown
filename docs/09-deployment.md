# Deployment

## Where it's hosted

**GitHub Pages**, built and deployed by a GitHub Actions workflow:
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

**Live URL:** https://arm000.github.io/hollow-crown/

Every push to `main` triggers a build and redeploy automatically — there
is no manual "publish" step. This matters beyond convenience: it means
the live URL is always the actual current phase of the game, so
[phase playability gates](08-roadmap-phases.md) — including the mobile
one — can be checked on a real phone by just opening the link, not by
running a local dev server on a laptop and guessing.

## Why GitHub Pages

- The repo already lives on GitHub with `gh` authenticated — no new
  account, no new service to trust with the code.
- The game is a pure static build (Three.js + Vite output,
  `localStorage` for saves, no backend — see
  [07-technical-architecture.md](07-technical-architecture.md)), which is
  exactly what Pages is for.
- Git-integrated: a deploy is just a normal `git push`.

The tradeoff we accepted to get this: **GitHub Pages on the free plan
only serves public repositories.** The repo was made public
(`arm000/hollow-crown`) specifically to enable this — source code, full
commit history, and these design docs are now publicly visible. Nothing
in the repo was written assuming secrecy, so this was a low-cost trade,
but it's worth knowing next time the "should this go public" question
comes up for a different repo, since it isn't reversible in effect (once
something's been published, treat it as seen even if the repo is later
turned back to private).

Revisit if a real need for a private-repo host shows up (Netlify/Vercel/
Cloudflare Pages can all deploy a private GitHub repo to a public site on
their free tiers without making the repo itself public) — see the
alternatives considered below.

## How the workflow works

```
push to main
  -> checkout
  -> npm ci
  -> npm run typecheck
  -> npm test                (see 11-testing-strategy.md — a failing test blocks the deploy)
  -> npm run build           (tsc -b && vite build -> dist/)
  -> upload dist/ as a Pages artifact
  -> deploy that artifact to the Pages environment
```

Two jobs (`build`, `deploy`) rather than one, matching GitHub's standard
Pages-via-Actions pattern — `deploy` uses the official
`actions/deploy-pages` action, which needs the `pages: write` and
`id-token: write` permissions declared in the workflow. A `concurrency`
group serializes deploys so two pushes in quick succession can't race
each other's artifact upload.

A separate workflow, `.github/workflows/ci.yml`, runs the same
typecheck+test+build sequence on every pull request — fast feedback
before merge, without waiting for a push to `main` to find out something
broke. See [11-testing-strategy.md](11-testing-strategy.md) for what
those tests actually cover and why both workflows run them rather than
relying on one or the other.

Trigger it manually without a new commit via the Actions tab's "Run
workflow" button, or:

```bash
gh workflow run deploy.yml
```

## Why no `base` path change was needed

`vite.config.ts` already sets `base: "./"` (relative asset paths), which
was chosen for portability rather than for Pages specifically — it means
the build works unmodified whether it's served from a domain root, from
a GitHub Pages project-site subpath (`/hollow-crown/`), or opened as a
local file. If this ever moves to a custom domain or a Pages *user* site
(`arm000.github.io` itself, not a project subpath), no config change is
needed either way.

## Checking a build before it ships

```bash
npm run build
npm run preview
```

`vite preview` serves the actual `dist/` output (not the dev server)
locally, which is the closest local approximation of what Pages will
serve — useful for catching anything that only breaks in a production
build (e.g. an import that only resolves in dev).

## First-time setup (already done, recorded for reference)

1. Repo visibility flipped to public (`gh repo edit ... --visibility
   public`) — required for free-plan Pages.
2. Pages enabled with the Actions build source (`gh api -X POST
   repos/arm000/hollow-crown/pages -f build_type=workflow`) — this has to
   happen once before the workflow's first run has anywhere to deploy to.
3. Workflow file added and pushed; first run builds and publishes the
   site.

## Alternatives considered

Recorded so the tradeoff is visible later, not because we expect to
switch:

| Option | Would've meant |
| --- | --- |
| **itch.io** | No repo visibility change needed; upload a zipped `dist/` manually (or scripted) per release. Better audience/discovery for an actual dungeon-crawler player base — worth adding *in addition to* Pages once there's a build worth putting in front of players (see [08-roadmap-phases.md](08-roadmap-phases.md#phase-6--full-campaign--release-polish)). |
| **Netlify / Vercel / Cloudflare Pages** | Git-integrated like Pages, deploys a private repo without making it public, adds per-branch preview URLs. Requires linking a new third-party account/service. |

Nothing here rules either out later — they're independent of the GitHub
Pages setup and can be added alongside it.
