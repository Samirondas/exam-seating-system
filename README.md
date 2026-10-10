# Examination Seating Arrangement Web App

A static HTML/CSS/JavaScript app intended for GitHub Pages. Seating allocation, sorting, search, matrix rendering and print layout run in the browser. Google Sheets stores the data through the Google Sheets API; no Apps Script is used.

## Files
- `index.html` — interface
- `styles.css` — responsive layout and A4 print styles
- `app.js` — Google OAuth, Sheets API, student import, room setup and seating logic

## Important security note
This is a browser-only app. Do **not** add a service-account private key or OAuth client secret to these files. The app uses Google OAuth 2.0 Authorization Code-less token flow via Google Identity Services. The OAuth Client ID is a public identifier; restrict it to your deployed website origin in Google Cloud.

## Google Cloud setup
1. Open Google Cloud Console and create/select a project.
2. Enable **Google Sheets API**.
3. Configure the OAuth consent screen. Add your own Google account as a test user if the app remains in Testing.
4. Create an OAuth Client ID of type **Web application**.
5. Under **Authorized JavaScript origins**, add your GitHub Pages origin, e.g. `https://YOUR-USERNAME.github.io`. If using a project site, the origin is still the host origin, not the `/repository/` path.
6. Copy the OAuth Client ID.
7. In `app.js`, replace `PASTE_YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE` with the client ID.
8. Do not publish a client secret. No client secret is required for this flow.

## Publish to GitHub Pages
1. Create a new GitHub repository, for example `exam-seating`.
2. Upload all three files to the repository root.
3. In `app.js`, add your OAuth Client ID and commit the change.
4. In repository **Settings → Pages**, choose deploy from branch, select `main` and `/ (root)`, then Save.
5. Open the published HTTPS page and sign in with the Google account that should own the spreadsheet.

## Use
1. Click **Sign in with Google**.
2. Click **Create new Google Sheet**. The app creates a spreadsheet with `STUDENT_MASTER`, `ROOM_MASTER`, `EXAM_MASTER`, and `SEATING_RESULT` tabs.
3. Upload a CSV or paste rows into the student data box. Expected columns: `Roll No, Student Name, Application No, Subject, Programme`. Roll numbers are kept as text so leading zeroes can be preserved when supplied as text.
4. Enter rooms as one per line: `Room No,Capacity,Rows,Columns`. Example: `101,30,5,6`. Rows and columns may be omitted and are estimated automatically.
5. Save students and rooms to Sheets if you want them persisted. Generate seating. Save the result to `SEATING_RESULT`.
6. Search and filter the generated result; click **Print A4 reports**.

## Data layout
- `STUDENT_MASTER`: Roll No, Student Name, Application No, Subject, Programme
- `ROOM_MASTER`: Room No, Capacity, Rows, Columns
- `EXAM_MASTER`: Exam Name, Semester, Exam Date, Session, Default Capacity
- `SEATING_RESULT`: exam fields, student fields, room, row, column and seat number

## Important limitations / production recommendations
- A static page cannot keep Google credentials secret. OAuth access tokens are held only in memory and are not written to localStorage.
- The spreadsheet ID is stored in this browser's localStorage for convenience. It is not a secret; spreadsheet access is still enforced by Google permissions.
- This starter version allocates students in the selected sort order, filling each room in sequence. It does not yet implement alternate-subject/alternate-roll constraints, room invigilator assignment, desk pairing rules, or a public student portal.
- For a multi-staff deployment, configure OAuth consent, authorized origins, access control, and test with a copy of real data before using in a live examination.
- Large datasets are processed in the browser, but the UI renders only the first 300 rows in the student preview. Keep the source sheet private and share only with authorized staff.
