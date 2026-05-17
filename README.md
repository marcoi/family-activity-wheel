# Family Activity Wheel

A single-page web app for spinning a wheel and picking a fun family activity. No build step required — static HTML, CSS, and vanilla JS.

## Run locally

The app loads `data/activities.json` via `fetch()`, so it needs a local HTTP server (opening `index.html` directly as a `file://` URL will show an instructions screen).

**Quickest way:**

```bash
cd family-activity-wheel
python3 -m http.server
```

Then open **http://localhost:8000** in your browser.

Other options: `npx serve .`, VS Code Live Server extension, etc.

## How to edit the activity list

Open `data/activities.json`. Each entry in `"activities"` looks like this:

```json
{
  "name": "Chess",
  "duration_min": 15,
  "duration_max": 60,
  "min_people": 2,
  "max_people": 2,
  "who": ["with_parents", "with_nanny", "with_friends", "kids_only"],
  "tags": ["strategy", "quiet", "indoor"]
}
```

| Field | Description |
|---|---|
| `duration_min` / `duration_max` | Time in minutes |
| `min_people` / `max_people` | Player count; use `null` for max if unlimited |
| `who` | One or more of: `kids_only`, `with_parents`, `with_nanny`, `with_friends` |
| `tags` | 2–4 tags from the vocabulary below |

**After adding or removing tags**, also update the `_meta.tags` array at the top of the file so the filter chips on the inputs screen stay in sync.

### Tag vocabulary

| Tag | Meaning |
|---|---|
| `quiet` | Low-energy, calm activity |
| `active` | Physical / energetic |
| `creative` | Arts, crafts, making things |
| `learning` | Educational focus |
| `screen` | Involves a device or screen |
| `messy` | Expect cleanup |
| `outdoor` | Best or only outside |
| `indoor` | Typically inside |
| `imaginative` | Pretend play, storytelling |
| `strategy` | Planning, tactics, puzzles |
| `social` | Better with more people |
| `solo-friendly` | Works fine with one person |

## Deploy to GitHub Pages

1. Push to GitHub.
2. Go to **Settings → Pages**, set source to the `main` branch root.
3. The site will be live at `https://<you>.github.io/<repo>/`.

All paths in the app are relative, so it works under any subdirectory without changes.
