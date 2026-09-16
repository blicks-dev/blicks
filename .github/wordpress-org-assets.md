# WordPress.org listing assets

How `.wordpress-org/` works. This file lives here, not in that directory, because the asset sync
publishes everything it finds there — a README beside the artwork ends up served from
`plugins.svn.wordpress.org/blicks/assets/`.

The files in `.wordpress-org/` are **not part of the plugin**. They are never included in the
release zip (see the allowlist in `scripts/bundle.js`). They belong in the `assets/` directory at
the **root of the plugin's SVN repository**, alongside `trunk/` and `tags/` — not inside `trunk/`.

```
https://plugins.svn.wordpress.org/blicks/
├── assets/          ← these files go here
├── tags/
└── trunk/           ← the plugin itself
```

`wporg-assets.yml` syncs this directory to SVN on any push to `main` that touches it, and
`release.yml` syncs it as part of a release.

## Icon and banner

| File | Size | Purpose |
|---|---|---|
| `icon-128x128.gif` | 128×128 | Plugin icon, standard density |
| `icon-256x256.gif` | 256×256 | Plugin icon, retina |
| `banner-772x250.png` | 772×250 | Listing header, standard density |
| `banner-1544x500.png` | 1544×500 | Listing header, retina |

The dimensions are what wordpress.org requires and must not change. The Directory accepts `.gif`
for the icon and animates it; the icons here are animated, which is why they are not `.png`.

**The animated icon composes the mark from nothing, so its first frame is blank.** Anywhere that
renders only frame one — some installer cards, some cached thumbnails — shows an empty square.
Reordering so frame 1 is the finished mark would fix it, at the cost of the build-up reading
backwards on loop.

## Screenshots

`screenshot-N.gif`, numbered from 1. Each one is captioned in `readme.txt` under its
`== Screenshots ==` section, matched by number — caption 3 describes `screenshot-3.gif`. Keep the
two in step: a caption must describe what its image shows, and a screenshot must never show a
feature the plugin does not ship. Mismatches are a common review comment.

Capture from a real install running the plugin built from `dist/blicks.zip` rather than a dev
symlink, so the listing shows what users get.

The three shipped screenshots are recorded walkthroughs of the real editor, not stills. The
recorder, the encoder and the frame compositor live in the workspace at `screenshots/walkthrough/`
— outside this repo, since none of it ships. Re-running it is how these get replaced.

## Current set

| | |
|---|---|
| `screenshot-1.gif` | the admin — Overview, Design System, a live preset swap |
| `screenshot-2.gif` | theme settings in the editor sidebar |
| `screenshot-3.gif` | inspector controls — Settings, Style, Advanced |

All three are under 2MB and framed with the brand surround. `readme.txt` carries the matching
`== Screenshots ==` captions.
