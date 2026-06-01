# Family Dues Management System

A standalone web application for managing family monthly dues, built with HTML/CSS/JavaScript (frontend), Google Apps Script (backend/API), Google Sheets (database), and Gmail (notifications).

## Architecture

```
Frontend (Static HTML)  →  Google Apps Script Web App  →  Google Sheets (FamilyDuesDB)
                                        ↓
                                   Gmail (notifications)
```

## Deployment Checklist

### 1. Set up Google Sheets database

1. Go to [Google Apps Script](https://script.google.com) and create a new project.
2. Copy the contents of `apps-script/Code.gs` into the script editor.
3. Copy `apps-script/sample_data_seed.gs` into the same project (optional, for testing).
4. Run the `setupDatabase()` function once from the script editor.
5. Authorize the script when prompted. This creates the **FamilyDuesDB** spreadsheet with all required sheets, columns, config defaults, and the default admin account.

### 2. Enable Gmail API

1. In the Apps Script editor, click **Services** (+) in the left sidebar.
2. Add **Gmail API** (or use the built-in `GmailApp` service — enabled by default for `GmailApp.sendEmail`).

### 3. Configure DUES_CONFIG

Open the **FamilyDuesDB** spreadsheet and update the **DUES_CONFIG** sheet:

| ConfigKey | Example Value |
|-----------|---------------|
| FamilyName | Asempa Royal Family |
| SystemEmail | your@gmail.com |
| TreasurerEmail | treasurer@gmail.com |
| MoMoNumber | 0241234567 |
| LoginUrl | https://your-site.github.io/familydues/index.html |

### 4. Deploy as Web App

1. In Apps Script, click **Deploy → New deployment**.
2. Select type: **Web app**.
3. Settings:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy** and copy the Web App URL.

### 5. Connect the frontend

1. Open `js/api.js`.
2. Replace `YOUR_DEPLOYMENT_ID` in `BACKEND_URL` with your deployed Web App URL:

```javascript
const BACKEND_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

### 6. Set up daily reminder trigger

Run `setupDailyTrigger()` once from the Apps Script editor. This creates a time-based trigger that runs `sendRemindersDaily()` every day at 8:00 AM.

Alternatively, set up manually:
- **Triggers → Add Trigger**
- Function: `sendRemindersDaily`
- Event: Time-driven, Day timer, 8am–9am

### 7. Seed admin account

The `setupDatabase()` function automatically creates:

| Username | Password | Role |
|----------|----------|------|
| admin | Admin@1234 | Admin |

Change the admin password after first login by creating a new user or resetting via the Users page.

### 8. Host the frontend

Deploy the static frontend files to **GitHub Pages**, **Netlify**, or any static hosting:

```
/index.html
/dashboard.html
/members.html
/payments.html
/reports.html
/users.html
/css/style.css
/js/api.js
/js/auth.js
/js/utils.js
```

For GitHub Pages: push to a repo, enable Pages from the `main` branch root.

### 9. Load sample data (optional)

Run `seedSampleData()` from the Apps Script editor to populate 10 dummy members and 3 months of payment records for testing.

### 10. Test all roles end-to-end

1. Log in as **admin** / **Admin@1234**.
2. Create users for each role (Admin, Treasurer, Secretary, Member).
3. Test member management, payment recording, reports, and email reminders.
4. Verify role-based access: each role should only see permitted pages and actions.

## Default Login

- **Username:** admin
- **Password:** Admin@1234

## Project Structure

```
familydues/
├── apps-script/
│   ├── Code.gs              # Backend API (all actions)
│   └── sample_data_seed.gs  # Test data seeder
├── css/
│   └── style.css            # Shared styles
├── js/
│   ├── api.js               # API client (GET requests)
│   ├── auth.js              # Session management
│   └── utils.js             # Helpers, toasts, formatting
├── assets/images/
│   └── asempa-royal-family-logo.jpeg  # Family logo (favicon, SEO, PWA)
├── site.webmanifest         # Mobile home-screen app manifest
├── js/branding.js           # SEO meta, Open Graph, shared brand constants
├── index.html               # Login page
├── dashboard.html           # Role-aware dashboard
├── members.html             # Member management
├── payments.html            # Payment recording
├── reports.html             # Reports and exports
├── users.html               # User management (Admin)
├── README.md
└── CHANGELOG.md
```

## Security Notes

- Passwords are SHA-256 hashed before storage and comparison.
- All API actions (except login, getConfig, setupDatabase) require a valid session token.
- Sessions expire after 8 hours of inactivity.
- Role enforcement is applied on both frontend (UI visibility) and backend (API rejection).
- All data-changing actions are logged to the AUDIT_LOG sheet.

## API Actions

All requests use GET with query parameters to avoid CORS preflight issues.

| Action | Roles |
|--------|-------|
| login | Public |
| getConfig | Public |
| addMember, updateMember | Admin, Secretary |
| deleteMember | Admin |
| getMembers | Admin, Treasurer, Secretary |
| createUser, updateUserRole, resetPassword, toggleUserActive, getUsers | Admin |
| recordPayment, getPayments, deletePayment | Admin, Treasurer |
| getMonthlySummary, getOverdueMembers, getYearEndSummary | Admin, Treasurer |
| getPaymentsByMember, getMemberHistory | Member (own data), Admin, Treasurer |
| sendReminders | Admin, Secretary |
| sendReminderToMember | Admin, Treasurer, Secretary |

## Email Notifications

Automated emails (via Gmail):
- **Payment recorded:** Receipt emailed to member with payment details
- **5 days before month end:** Monthly reminder to unpaid members
- **Day after deadline:** Overdue notice to unpaid members + consolidated alert to Treasurer/Admin
- **Account created:** Welcome email with credentials
- **Password reset:** New temporary password email
