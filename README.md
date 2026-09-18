# Noctua Announcements

Announcements shown in the Noctua landing page, the Standard Annotation Editor and
the Visual Pathway Editor — planned outages, updates, new feature documentation,
getting started links, and anything else worth putting in front of active Noctua
users.

**Posting an announcement? → [AUTHORS.md](AUTHORS.md)**

## How it's displayed

### Banner

The most recent active announcement shows as a banner with its title, first
paragraph, and a link to more detail. A bell shows how many announcements there
are; clicking it opens the panel.

![image](https://user-images.githubusercontent.com/2273929/180366258-36b456c3-e4cf-4055-8474-31f70092788f.png)

### Panel

The panel lists every active announcement in full.

![image](https://user-images.githubusercontent.com/2273929/180373574-04652685-1f1a-45ec-ad8d-4ecf52d15569.png)

## How it works

```
announcements/*.md  →  GitHub Action  →  announcements.json  →  Noctua apps
   (what you edit)      (validates)        (published to Pages)
```

One Markdown file per announcement in [`announcements/`](announcements). Each has
a YAML frontmatter block for the settings and Markdown below it for the text.
Commit to `main` and a GitHub Action validates every file, builds them into a
single JSON feed, and publishes it to GitHub Pages.

**If validation fails, nothing is published and the previous feed stays live.**
The deploy step only runs when the build succeeds, so a malformed commit can't
take the banner down — it just doesn't update. GitHub emails the author with what
went wrong.

## For developers

**Feed URL:** `https://geneontology.github.io/noctua-announcements/announcements.json`

Served by GitHub Pages with `Access-Control-Allow-Origin: *`, so it's fetchable
from the browser. Pages purges its CDN on deploy, but browsers cache for 10
minutes — fetch with `cache: 'no-store'` if you want changes to land promptly.

The feed is a flat array, newest first:

```json
[
  {
    "id": "2026-03-14-march-maintenance",
    "title": "Scheduled maintenance Friday",
    "level": "danger",
    "type": "maintenance",
    "pinned": false,
    "testing": false,
    "apps": ["landing-page", "sae", "vpe"],
    "starts": "2026-03-10",
    "expires": "2026-03-16",
    "description": "Noctua will be down for about 30 minutes on Friday at 4:00 PM PST.",
    "body": "<p>Noctua will be down for about 30 minutes…</p>",
    "descriptionUrl": null
  }
]
```

- `level` is severity (colour); `type` is category (icon). Both are always present,
  `type` defaulting to `announcement`.
- `pinned` is always present. A pinned announcement sorts first, should always show
  its banner, and **must not be dismissible** in the consumer.
- `description` is the first paragraph as plain text — banner copy.
- `body` is the full text as sanitized HTML — panel copy. Sanitizing happens at
  build time; links are rewritten with `target="_blank" rel="noopener noreferrer"`.
- `starts` / `expires` are `YYYY-MM-DD` or `null`. **Consumers must filter on
  these** — the feed ships every announcement, active or not. Compare as strings
  against the local date to avoid a UTC off-by-one.
- `apps` is always present, defaulting to all three: `landing-page`, `sae`
  (Standard Annotation Editor), `vpe` (Visual Pathway Editor). **Consumers must
  filter on this too.**
- `testing` is always present, defaulting to `false`. `true` means the announcement
  is a draft: **consumers must show it only in a non-production build — the dev site —
  and never in production.**
- `expires` is exclusive: an announcement stops showing on that date.
- Order is pinned first, then newest first.

Treat a failed fetch as "no announcements" and never block app render on it.

### Building locally

```
npm install
npm run build      # writes dist/announcements.json
```

The build prints each announcement with its level and active window, which is a
quick way to sanity-check scheduling before committing.

Frontmatter rules live in [`schema.json`](schema.json); the build is
[`scripts/build.mjs`](scripts/build.mjs).
