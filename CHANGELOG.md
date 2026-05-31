# Changelog

All notable features of the Family Dues Management System, completed across Phases 1–10.

## Phase 1 — Google Sheets Database Setup

- One-time `setupDatabase()` function creates **FamilyDuesDB** workbook
- **MEMBERS** sheet with auto-generated MemberID (FM001 format), status, exemption, and custom dues amounts
- **USERS** sheet for login credentials with SHA-256 password hashes and role assignments
- **PAYMENTS** sheet with auto-generated PaymentID (PAY-YYYY-NNN format)
- **DUES_CONFIG** sheet with deadline, currency, family name, reminder settings, and MoMo number
- **AUDIT_LOG** sheet for tracking all system actions
- **SESSIONS** sheet for token-based session management
- Default Admin account seeded (admin / Admin@1234)

## Phase 2 — Google Apps Script Backend

- Single `Code.gs` deployed as Web App with `doGet`/`doPost` router
- JSON responses: `{ success, data, error }`
- GET-based API calls to prevent CORS preflight issues
- AUTH: login with session token generation and audit logging
- MEMBERS: add, update, soft-delete (deactivate), list, get by ID
- USERS: create, update role, reset password, toggle active, list
- PAYMENTS: record (with Active/non-exempt validation), list with filters, delete (Admin only)
- REPORTS: monthly summary, member history, overdue members, year-end summary
- REMINDERS: automated and manual reminder sending
- Role enforcement on every authenticated action
- Time-based trigger setup via `setupDailyTrigger()` (daily at 8:00 AM)

## Phase 3 — Frontend Structure and Auth

- Multi-page standalone web app with shared CSS and JS modules
- Deep green (#1B5E20) and gold (#FFC107) design with Inter font
- Mobile-first responsive layout with collapsible sidebar
- Login page with family branding, error handling, and session redirect
- Session management via localStorage with 8-hour inactivity expiry
- Toast notifications and loading spinners on all async actions
- Role-based navigation visibility

## Phase 4 — Dashboard

- Role-aware welcome message with current month display
- Personal dues summary card for all roles (PAID / UNPAID / EXEMPT)
- Admin/Treasurer: eligible, paid, unpaid counts, collected/outstanding totals
- Chart.js bar chart for 6-month collection history
- Secretary: active member and exemption counts with quick actions
- Member: 12-month payment history table with status badges
- Quick action buttons per role

## Phase 5 — Member Management

- Searchable, sortable member table with status badges
- Filters: All / Active / Exempt / Inactive
- Add Member modal with full field validation
- Edit Member modal with pre-populated data
- Deactivate member with confirmation (Admin only)
- Export filtered list to CSV

## Phase 6 — Payment Recording

- Record Payment panel with member dropdown (eligible, non-exempt only)
- Auto-fill dues amount, month selector, editable amount paid
- Payment channel: MoMo (with required reference) or Cash
- Payment log table with month, member, and channel filters
- Delete payment with reason prompt (Admin only)

## Phase 7 — Reports

- **Tab 1 — Monthly Summary:** cards, paid/unpaid tables, per-row reminders, CSV export, print
- **Tab 2 — Member History:** member selector, payment table, compliance summary, CSV export
- **Tab 3 — Overdue Members:** auto-filtered overdue list, remind all, CSV export
- **Tab 4 — Year-End Summary:** per-member compliance with color coding, family totals, CSV export, print

## Phase 8 — User Management

- Admin-only user list with status badges and last login
- Create User modal: member link, username, temp password, role assignment
- Edit User modal: change role, enable/disable, reset password
- Welcome and reset emails sent automatically via Apps Script

## Phase 9 — Email Templates

- HTML email templates styled with green/gold family branding
- Monthly Reminder (5 days before end of month)
- Overdue Notice (day after deadline)
- Treasurer Alert (consolidated overdue table)
- Welcome / Account Created email
- Password Reset email
- Footer: "Powered by Family Dues System"

## Phase 10 — Security, Polish and Deployment

- SHA-256 password hashing throughout
- Session token validation on all protected API actions
- Dual role enforcement (frontend UI + backend API)
- Audit logging for all data-changing operations
- 8-hour session inactivity timeout
- Empty-state messages on all tables
- Client-side form validation with error messages
- Confirm dialogs for destructive actions
- Date formatting: DD MMM YYYY
- Currency formatting: GHS X,XXX.XX
- Per-page browser tab titles
- README.md deployment checklist
- sample_data_seed.gs with 10 members and 3 months of payments
