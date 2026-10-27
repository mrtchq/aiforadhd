# Ghost theme — live site mirror

This directory mirrors the theme that is **actually active on the live site**, not a design draft.
It is refreshed daily (20:00 ET) by `~/.hermes/scripts/aiforadhd_theme_sync.sh` on the VPS.

| Field | Value |
|---|---|
| Site | https://aiforadhd.xyz |
| Active theme | `ai-for-adhd-v2` |
| Ghost version | 6.72.0 |
| Source on VPS | `/var/www/ghost/content/themes/ai-for-adhd-v2` |

## Layout

- `ai-for-adhd-v2/` — **the live theme**.
- `aiforadhd-hybrid/` — previously active theme, kept for history. **Not live.**

## Sync rules

1. The live theme is whatever `settings.active_theme` says in Ghost's database — never inferred
   from a directory name, a screenshot, or a previous session's notes.
2. Working backups named `*.bak-<editor>-<date>` are **excluded** on purpose; git history is
   the real record of the theme's evolution.
3. Runtime directories (`node_modules/`, `.git/`, logs) are excluded.
4. No content export is committed. Ghost's JSON export contains staff and member records and
   this repository is public — theme code only.
5. Ghost caches compiled templates in memory: after restoring files, the service must be
   restarted before template changes become visible.
