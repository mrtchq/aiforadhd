# Ghost theme — live site mirror

This directory mirrors the theme that is **actually active on the live site**, not a design draft.

| Field | Value |
|---|---|
| Site | https://aiforadhd.xyz |
| Active theme | `ai-for-adhd-v2` (package name `ai-for-adhd`, v1.0.0) |
| Ghost version | 6.72.0 |
| Source | `/var/www/ghost/content/themes/ai-for-adhd-v2` on the VPS |
| Last synced | 2026-10-27 03:35 UTC |
| Published content at sync | 0 posts, 1 page, 40 tags |

## What is in here

- `ai-for-adhd-v2/` — **the live theme**. Handlebars templates (`index.hbs`, `default.hbs`,
  `members-portal.hbs`, `page-account.hbs`, `sprint*.hbs`, `tag.hbs`, `author.hbs`, `error.hbs`,
  `post.hbs`, `partials/`), `assets/css/`, `assets/js/`, `assets/images/`, `locales/`, `routes.yaml`.
- `aiforadhd-hybrid/` — the previously active theme, kept for history. **Not live.**

## Sync rules

1. The live theme is whatever `settings.active_theme` says in Ghost's database — never infer it from a
   directory name, a screenshot, or a previous session's notes. It has already moved once
   (`aiforadhd-hybrid` → `ai-for-adhd-v2`).
2. Working backups named `*.bak-<editor>-<date>` are **excluded** on purpose. They pile up in the live
   theme directory during editing sessions and are noise in version control; git history is the real
   record.
3. Runtime directories (`node_modules/`, `.git/`, logs) are excluded.
4. No content export is committed. Ghost's JSON export contains staff and member records, and this
   repository is public — theme code only.
5. After pushing, verify the served site still renders: Ghost caches compiled templates in memory, so a
   template change needs `systemctl restart ghost_blog-mrtc-xyz.service` before it is visible.

## Restoring this theme to a Ghost install

```bash
rsync -a ai-for-adhd-v2/ /var/www/ghost/content/themes/ai-for-adhd-v2/
chown -R ghost:ghost /var/www/ghost/content/themes/ai-for-adhd-v2
# then set the active theme in Ghost admin (Settings → Design) or via the Admin API
systemctl restart ghost_blog-mrtc-xyz.service
```
