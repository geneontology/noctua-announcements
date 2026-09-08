# Writing an announcement

This is the guide for whoever is posting announcements. You don't need to install
anything or know git — everything here happens on the GitHub website.

## Adding a new announcement

1. Go to the [`announcements`](announcements) folder.
2. Click **Add file → Create new file**.
3. Name the file with today's date and a few words, ending in `.md`:
   `2026-03-14-march-maintenance.md`
4. Paste this in and edit it:

```
---
title: Scheduled maintenance Friday
level: danger
expires: 2026-03-16
---

Noctua will be down for about 30 minutes on Friday at 4:00 PM PST.
Please save your work before then.
```

5. Click **Commit changes**.

That's it. Within a minute or two it's showing in Noctua. There's nothing to
approve and nobody to wait for.

If you'd rather start from a copy, open
[`announcements/_template.md`](announcements/_template.md) and use that as your
starting point. (Files whose name starts with `_` are ignored, so the template
itself never shows up as an announcement.)

## The settings block

Everything between the two `---` lines is settings. Everything below is the text
of the announcement.

| Setting | Required? | What it does |
| --- | --- | --- |
| `title` | **yes** | The headline. Keep it short — it shows in the banner. |
| `level` | **yes** | How urgent it is, which picks the color. |
| `type` | no | What kind of thing it is, which picks the icon. Defaults to `announcement`. |
| `pinned` | no | `true` keeps it at the top and stops people dismissing it. |
| `expires` | no | The day it stops showing, as `YYYY-MM-DD`. Leave it out and it shows forever. |
| `starts` | no | The day it starts showing, as `YYYY-MM-DD`. Leave it out and it shows right away. |
| `apps` | no | Which apps show it. Leave it out and all three do. |
| `descriptionUrl` | no | A link to a Google Doc, wiki page, or slides, shown as a "More details" button. |

### `level` — the colors

| Value | Color | Use it for |
| --- | --- | --- |
| `info` | blue | Most things. New features, links, meetings. |
| `success` | green | Something finished well — maintenance is over, a release went out. |
| `warning` | yellow | Something people should know before it bites them. |
| `danger` | red | Outages and anything urgent. |

### `type` — the icon

`level` says how urgent something is. `type` says what kind of thing it is, and
picks the icon shown beside it in the notification list.

| Value | Icon | Use it for |
| --- | --- | --- |
| `announcement` | megaphone | General news. This is the default. |
| `update` | sparkles | A release, new features, a changelog. |
| `reminder` | alarm clock | A nudge about something already announced. |
| `maintenance` | wrench | Outages and downtime. |
| `event` | calendar | Meetings and workshops. |

Note there's no `warning` type — urgency is what `level` is for, so a warning is
`level: warning` with whatever `type` actually describes it.

### `pinned` — making one stay put

A pinned announcement sits at the top of the list, always shows its banner, and
**cannot be dismissed or cleared**. It only goes away when you delete it or its
`expires` date passes.

```
---
title: Noctua is in read-only mode
level: warning
type: maintenance
pinned: true
---

Saving is disabled while we migrate the database. We'll post again when it's back.
```

Use this sparingly — one at a time at most. A banner nobody can close is
irritating fast, so it's for things people genuinely must not miss, like an
ongoing outage. For everything else, leave `pinned` out and let people dismiss it.

### `apps` — showing it in only some places

Leave `apps` out and the announcement shows everywhere. To narrow it:

```
apps: [vpe]                  # Visual Pathway Editor only
apps: [form, vpe]            # both editors, not the landing page
```

The three names are `landing` (the Noctua landing page), `form` (the Form Editor)
and `vpe` (the Visual Pathway Editor).

### `starts` and `expires` — scheduling

You can write an announcement ahead of time. This one appears on March 10th and
disappears on its own after March 16th:

```
starts: 2026-03-10
expires: 2026-03-16
```

`expires` is the one worth using often — it means you don't have to remember to
come back and take the announcement down.

## The text below the settings

The first paragraph is what shows in the **banner**, so keep it to a sentence or
two. Everything after it shows in the **panel** that opens when someone clicks the
bell, so that's where longer detail goes.

You can use **bold**, *italics*, [links](https://geneontology.org), and bulleted
lists. Headings work too, for longer posts.

## Changing or removing an announcement

- **To change one:** open the file, click the pencil icon, edit, commit.
- **To take one down early:** open the file and click the delete (trash) icon, then
  commit. Or just set `expires` to yesterday.
- **To take one down on schedule:** you already did, if you set `expires`.

Deleting the file is fine — the announcement is in the repository history if you
ever need it back.

## If something goes wrong

Nothing you commit can break Noctua's banner.

Every commit is checked before it goes live. If there's a problem with a file —
a misspelled `level`, a date in the wrong shape, a missing title — **nothing is
published, and the announcements that are already showing stay exactly as they
are.** The banner never goes blank because of a typo.

When that happens GitHub emails you, and the email says what was wrong, in plain
words. For example:

```
announcements/2026-03-14-march-maintenance.md
    - "level" must be one of: info, success, warning, danger
```

Fix the file, commit again, and it publishes.

If you want to see the check yourself, the **Actions** tab at the top of the
repository lists every commit and whether it published. A green check means it's
live; a red X means the email is waiting for you.

## Common mistakes

**Dates in the wrong shape.** It has to be `2026-03-14` — four-digit year, then
month, then day, with dashes. Not `March 14` and not `3/14/26`.

**A colon in the title.** If your title has a colon in it, put quotes around the
whole thing:

```
title: 'Meeting: Cal Tech'
```

**Forgetting the closing `---`.** The settings block needs a line of three dashes
above it and another below it.
