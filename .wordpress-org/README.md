# WordPress.org listing assets

These files are **not part of the plugin**. They are never included in the release zip (see the
allowlist in `scripts/bundle.js`). They belong in the `assets/` directory at the **root of the
plugin's SVN repository**, alongside `trunk/` and `tags/` — not inside `trunk/`.

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
| `icon-128x128.png` | 128×128 | Plugin icon, standard density |
| `icon-256x256.png` | 256×256 | Plugin icon, retina |
| `banner-772x250.png` | 772×250 | Listing header, standard density |
| `banner-1544x500.png` | 1544×500 | Listing header, retina |

The dimensions are what wordpress.org requires and must not change. The in-product brand mark
(`resources/admin/icons.tsx` → `StackBMark`) on accent `#002bff` / `#4d8bff` over `#070b18` is a
usable source for a first set.

## Screenshots

`screenshot-N.png`, numbered from 1. Each one is captioned in `readme.txt` under a
`== Screenshots ==` section, matched by number — caption 3 describes `screenshot-3.png`. That
section is not in `readme.txt` today; add it alongside the images, and keep the two in step.
A caption must describe what its image shows, and a screenshot must never show a feature the
plugin does not ship — mismatches are a common review comment.

Capture from a real install running the plugin built from `dist/blicks.zip` rather than a dev
symlink, so the listing shows what users get.

## Status

The icon, banner and screenshot files are not in this directory, and `readme.txt` carries no
`== Screenshots ==` section. Adding artwork means adding both. The asset sync steps run either
way and publish whatever is here.
