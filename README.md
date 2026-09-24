# Folio by UNIO

A local-first document management workspace for organizing, previewing, searching, and reviewing files.

Built with **React, TypeScript, Vite, and a Tauri 2 desktop shell**, with a local authenticated API and optional Docker-based office integrations.

## Project overview

- Three-panel workspace with folder navigation, file lists, and document previews.
- Document search, tags, metadata, favorites, and saved searches.
- Admin, Editor, and Reader roles with department and Personal workspaces.
- Version history, review workflows, comments, and a recoverable recycle bin.
- Browser and desktop development paths, plus optional locally hosted office services.

This repository includes implementation, tests, and setup instructions. Feature limitations are documented below; this overview does not claim production deployment or independently verified production readiness.

---

A local-first document workspace based on the supplied three-panel design. React, TypeScript, Vite, and a Tauri 2 desktop shell. No cloud services are required.

## Run in the browser

```sh
npm install
npm run dev
```

Open http://localhost:1420. `npm run dev` starts both Vite and the local Folio API. On the first run, create the administrator account. Development server data is stored in `.folio-data`. Browser-only workspaces from earlier Folio versions can be copied into the server from **Settings → Configuration → Import browser workspaces**.

## Run with Docker

Install Docker Desktop, then run this from the project folder:

```sh
docker compose up --build -d
```

Copy `.env.example` to `.env`, replace `JWT_SECRET`, then open http://localhost:1420. The compose stack serves Folio, the authenticated API, the local editor bridge, LibreOffice conversion, and ONLYOFFICE DocumentServer. Stop it with `docker compose down`; accounts, metadata, versions, recycle-bin items, and documents remain in named Docker volumes.

Create a backup with `./scripts/backup-data.ps1`. Restore one with `./scripts/restore-data.ps1 -Backup <archive>`. A restore replaces the current server data, so create a fresh backup first. `VERSION_RETENTION` controls versions retained per file and `TRASH_RETENTION_DAYS` controls automatic recycle-bin cleanup. OCR defaults to English and 50 PDF pages; set `OCR_LANGUAGES` to installed Tesseract languages such as `eng+spa` and adjust `OCR_MAX_PAGES` when needed.

For the existing WSL office setup on Windows, start the services with:

```powershell
.\scripts\start-office.cmd
```

This launcher avoids changing PowerShell’s execution policy.

## Desktop app

Install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (Rust and Windows C++ build tools), then:

```sh
npm run tauri dev
# Create an installer:
npm run tauri build
```

The desktop repository is `~/Folio`. Commands are scoped to that directory; traversal and linked paths outside it are rejected. Supported document types open through the OS default editor without constructing shell command strings. Documents remain ordinary files. Preferences, favorites, recent file references, and panel widths use local WebView/browser storage. There is no document database or proprietary archive.

## Available now

- Folder tree, file list, and large preview panel; tablet drawer and mobile navigation.
- PDF.js and formatted DOCX page previews, with page navigation and fullscreen. DOCX previews retain document styles, tables, images, headers, footers, and saved page breaks in an isolated frame. PDFs, Word documents, images, text, and CSV tables all support 25–300% zoom.
- Folder and file create/import, rename, move, delete; right-click menus and file drops.
- Filename, folder-path, tags, metadata, OCR, and document-content search; favorites, saved searches, and recents.
- Accounts with Admin, Editor, and Reader roles; department access; private Personal workspaces.
- Tags with global rename, colors, merging, and deletion; editable and resolvable comments; direct-opening mentions; multi-stage approvals with deadlines; review dates; activity history; downloadable/restorable versions; text-file version comparison; and a recoverable recycle bin with retention controls.
- Bulk tag, copy, move, ZIP download, and delete, including server-side cross-department transfers.
- Optional desktop/browser notifications for new mentions. Enable them under **Settings → Appearance**; Folio continues to show the same notices inside the app.
- Tauri system-editor opening and show-in-folder commands. Browser mode exports the original instead.
- Offline frontend assets and locally processed previews; no external fonts or document conversion service.

## Current limits

- The desktop shell requires the Rust toolchain; check the task report for validation performed on this machine.
- XLSX previews include worksheet tabs, cached formula results, basic cell styling, and number formatting (limited to 500 rows and 50 columns). Charts and complete Excel print layout are not rendered. PPTX previews show positioned text and embedded images; master layouts, themes, charts, and animations may differ. Older binary DOC/XLS/PPT and unsupported formats still require an external application. DOCX rendering uses local browser layout rather than Microsoft Word; unavailable fonts and complex pagination can differ from Word. PDFs remain the most reliable fixed-layout representation. No document content is sent to an online converter.
- External identity providers and email delivery are not implemented. Accounts, in-app notifications, and optional browser notifications are hosted by the Folio server.
- Side-by-side version comparison is available for text-based formats. Office and PDF versions can be downloaded, restored, and compared in their native application.
- Desktop uses a fixed `~/Folio` root; browser mode can choose another root. OS defaults determine preferred desktop editors.
- Metadata is keyed by repository mode/name and relative path. Browser roots with identical names share metadata. Reconnect after reload; no background filesystem watcher (use Refresh).
- Preview reads are limited to 100 MB. Text previews display at most 500,000 characters; CSV previews are capped. Large repositories are scanned recursively.
- Server deletion uses the recycle bin; administrators can permanently remove an item. Browser-only and connected-folder deletion follows the storage provider's behavior.
- Browser folder upload preserves nested files but not empty directories. Drag in files or use Import folder for nested imports.

## Verification

```sh
npm run build
npm test
```

## Production checklist

- Put Folio behind an HTTPS reverse proxy and restrict ports `1421`, `1423`, and `8080` to the host or private network.
- Generate a long random `JWT_SECRET`; keep `.env` out of source control and rotate the secret if it is exposed.
- Run `scripts/backup-data.ps1` on a schedule and test a restore on a separate installation before relying on the backup.
- Keep Docker, the Folio images, and ONLYOFFICE patched. Review container logs and failed-login activity regularly.
- Use a dedicated service account and least-privilege filesystem permissions for the Docker volumes.
