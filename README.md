# Exam Management Portal — migration build (Digital Notice Board excluded)

## What this build does
- Connects to an existing Google Sheets workbook using Google OAuth and the Sheets API.
- Reads `Applicant Data`, `Seating_Database`, `Absentee Statement`, and `Despatch Report` when present.
- Provides Daily Dashboard, Seating Summary, Attendance print view, printable Notice Board grouping, Sticker list, Student Search, Subject-wise roll grouping, Room-wise grouping, Top Sheet candidate grouping, Absentee and Despatch views.
- Filters by date/session/room/programme; exports visible report rows to CSV; prints A4 browser reports.
- Does not write, clear, rename, create, or delete any legacy sheet data.
- Does not include Digital Notice Board code, QR page, or activation scheduler.

## Setup before publishing
1. In Google Cloud Console enable Google Sheets API and configure OAuth consent.
2. Create an OAuth Client ID of type Web application. Add authorized JavaScript origin `https://samirondas.github.io` (or your own Pages origin).
3. In `app.js`, replace `PASTE_YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE` with your OAuth Client ID. Do not add a client secret or service-account key.
4. Upload `index.html`, `app.js`, and `styles.css` to a *new branch or separate test repository first*. Do not overwrite your live site before testing.
5. Open the site, sign in with an account that already has access to the legacy workbook, and paste its Spreadsheet ID.

## Important limitations
This is a **read-only migration build**, not a complete replacement of all server-side Apps Script writes. Create/Modify/Delete seating map, allocation persistence, saving absentee entries, and updating despatch records are intentionally not enabled yet: the original Apps Script logic relies on exact legacy column layouts, and a mistaken write could damage live examination data. These need schema-by-schema porting and testing against a copied workbook before activation.

The legacy source uses fixed positional columns in `Seating_Database` (A exam date, B exam half, C roll, D paper code, E paper type, F college code, G room, H semester, I exam year, J programme year, K optional VAC system code). The app uses header matching where possible, so the report may need adjustments if actual headers differ or those columns are unnamed. Verify the displayed output against the original Apps Script before official use.

No existing Google Sheet has been modified by generating this package.
