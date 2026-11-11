# Image brief for Antigravity (Gemini image generation)

Job: generate the images below, check each against the rules, regenerate until it passes, then save it with the EXACT filename and folder shown (paths are from this repository's root).
The code already points at these paths. Do not edit any code. Do not rename, add or skip files. Until a file exists the app shows an icon or letter instead, so nothing breaks.

## Rules for every image
- Format: WebP, exactly 1024x1024 (square), under 150 KB.
- Subject centred, about 12% empty margin on every side.
- Product photos: realistic studio photo, soft light, plain light-grey seamless background (#f1f3f5), soft floor shadow. Same camera angle and lighting across all product photos.
- Logos: flat vector-style mark on a solid background (see the prompt), no gradients, no shadow, readable at 32 px.
- No text, letters, brand names, watermarks, hands or people (the Learnly logo's single "L" shape is the only exception).
- Product anatomy must be correct: no extra buttons, bent straps, broken cables, mirrored or melted parts.
- Pass check: view it at 64 px and at full size. It must stay recognisable at 64 px.

## Files

| # | Save as | Used by the code | Prompt |
|---|---|---|---|
| 1 | `apps/web/public/img/logo.webp` | Logo tile in the header, login and register pages | Simple flat logo mark for an online learning platform called Learnly: a bold rounded letter "L" that doubles as an open book, white on a solid royal-blue (#2563eb) rounded-square background, centred, no other text |

The component is `apps/web/components/Img.tsx`.

## After saving
Tell Claude Code "images saved". It will rebuild, redeploy and check each image in the browser.
