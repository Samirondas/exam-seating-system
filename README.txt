EXAM MANAGEMENT PORTAL — READABLE FRONT-END FIX

This package restores a readable sidebar-style front end and forces normal Arial/Helvetica text fonts. Digital Notice Board remains excluded. The current build is read-only; Save/Modify seating-map actions are not implemented in this migration package.

IMPORTANT: Before uploading app.js, open it and replace PASTE_YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE with the OAuth Web Client ID from your Google Cloud project. Do not put the Client Secret in this static website. The existing spreadsheet data is not modified.

UPLOAD STEPS
1. Open the GitHub repository: https://github.com/Samirondas/exam-seating-system
2. Open each of these files in the repository: index.html, styles.css, app.js.
3. For each file choose Edit (pencil), replace the complete contents with the matching file from this ZIP, and Commit changes.
4. Wait for GitHub Pages to publish, then open https://samirondas.github.io/exam-seating-system/ and press Ctrl+F5.
5. Sign in and connect the existing spreadsheet.

SAFETY
- Do not delete or rename any Google Sheet tabs.
- Do not change spreadsheet data while testing.
- Digital Notice Board is not included.
- This is not yet a full port of Google Apps Script write features.
