# AI Chat Exporter

Two bookmarklet exporters, deployed as separate pages:

- `chatgpt-export/` exports ChatGPT conversations as Markdown files.
- `claude-export/` exports Claude conversations as Markdown files.

## Development

### Setup

```bash
cd chatgpt-export && npm install
cd ../claude-export && npm install
```

### Building

Each project uses obfuscated JavaScript for its production bookmarklet. Build each page from its own folder:

```bash
npm run build
```

The build writes the obfuscated bookmarklets and a copy of `index.php` to that project's `dist/` directory. `dist/` holds everything the server needs, so deploy its contents. `index.php` loads the bookmarklets from its own folder, so it works only from `dist/`.

### Versioning

Each page's version is `<major>.<work-day>.<daily-commit>`, the format hlsync uses. The build computes it from Git and writes it into `dist/index.php` in place of `{{VERSION}}`. It starts from the version and commit in the project's `version.json`, then counts the first-parent commits that touch that project's folder: each new day with commits advances the work day, and the daily commit is the number of commits on the latest day. Commit before building, because uncommitted changes don't count.

### Files

- `chatgpt-export/markdown_bookmarklet.js` - ChatGPT Markdown exporter source.
- `claude-export/claude_markdown_bookmarklet.js` - Claude Markdown exporter source.
- `*/build.js` - Project-local build script for obfuscation.
- `*/index.php` - Project-local install page.

Generated `dist/` files are excluded from git.

## Usage

Visit the relevant project's `index.php` page and drag its bookmarklet to your bookmarks bar.
