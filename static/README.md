# Online Clearance System — Static (HTML/CSS/JS)

A complete pure-frontend port of the React app. All three roles, departments, dues, audit timeline, certificates, dark mode, analytics. **Zero build step.**

## Run

Open `index.html` in a browser, or serve the folder:

```
npx serve static
# or
python3 -m http.server -d static 8080
```

## Modes (edit `config.js`)

- `MODE = "local"` — fully offline. All data persists in `localStorage`.
  - The **first signup becomes Master Admin** automatically.
  - Use the **Seed demo users + apps** button on the Profile page to populate sample data:
    - `librarian@uni.edu` / `finance@uni.edu` / `alice@uni.edu` / `bob@uni.edu` — password `demo1234`
- `MODE = "cloud"` — uses Lovable Cloud (Supabase) for real auth, RLS, storage.

## Features

- **Three roles**: Student, Department Admin, Master Admin
- **Configurable departments** (Library, Hostel, Finance, Examination, Sports, Lab/Department by default)
- **Per-department dues breakdown** with totals
- **Document upload** per department per application
- **Detailed student profile** with full audit timeline
- **Department review queue** with approve/deny + 5-min undo
- **Master override** of any department status
- **Analytics dashboard** (Chart.js) — status distribution, avg approval time, per-dept breakdown
- **Printable clearance certificate** with QR verification code
- **Dark mode** toggle (persisted)
- **Mobile-responsive** sidebar, fully responsive grids
- **CSV export** of all applications

## File layout

```
static/
├── index.html
├── styles.css
├── config.js
└── js/
    ├── utils.js   — DOM helpers, toast, modal, status badges, icons
    ├── db.js      — unified data API (cloud + local)
    ├── cert.js    — certificate modal + QR
    ├── pages.js   — every page/dashboard
    └── app.js     — shell, router, auth state
```
