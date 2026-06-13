# Country Photos

This directory contains country-specific photo folders for the travel map gallery.

## How to Add Photos

1. Place your **1×1 square photos** (recommended: 400×400px or larger) into the appropriate country subfolder:
   - `india/` → India photos
   - `germany/` → Germany photos
   - `switzerland/` → Switzerland photos
   - `iceland/` → Iceland photos
   - `france/` → France photos
   - `hungary/` → Hungary photos
   - `netherlands/` → Netherlands photos
   - `belgium/` → Belgium photos
   - `austria/` → Austria photos

2. Update `data/photos.json` to list the file paths:

```json
{
  "india": [
    "assets/photos/india/photo1.jpg",
    "assets/photos/india/photo2.jpg"
  ],
  "germany": [
    "assets/photos/germany/goettingen.jpg"
  ]
}
```

Photos will appear in a grid below the country map when you click a country on the travel globe.
Clicking a photo opens a full-screen lightbox. Press **Escape** or click to close.
