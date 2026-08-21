# johndlr.com

John de los Reyes's personal website — Ontario, California. Las Vegas Raiders
fan and owner of a 1954 Chevrolet Bel Air.

A static site, no build step and no dependencies beyond a Google Fonts import.

## Structure

```
index.html        Single-page site (About, The Bel Air, Raider Nation, Gallery, Contact)
css/styles.css     All styling (dark, Raiders-themed: black + silver)
js/main.js         Small progressive enhancement (active nav highlight, footer year, mobile nav)
assets/favicon.svg Site icon
robots.txt
```

## Editing content

Everything is in `index.html` — no CMS or templating. A few spots are marked
with HTML comments (`<!-- John/David: ... -->`) where real details still need
to be filled in:

- The Bel Air's story/specs (engine, paint, restoration history) in the
  "Spec sheet" card.
- John's gameday tradition in the Raider Nation section.
- Real photos — swap the dashed placeholder boxes (`.placeholder-box`) for
  `<img>` tags once you have photos of John, the car, and Raiders gear.
- The contact email/social links in the Contact section.

## Local preview

Any static file server works, for example:

```
npx serve .
```

## Deploying

This is a static site — point `johndlr.com` at whatever static host you like
(Netlify, Vercel, GitHub Pages, S3 + CloudFront, etc.) and serve this
directory as the site root.
