# FACTS - File and Case Tracking System

A comprehensive case management and welfare tracking system designed for Baaseteen and SHND (Social Help and Development) organizations. FACTS manages the complete lifecycle of welfare cases — from applicant identification and eligibility assessment through counseling, multi-level approval workflows, financial disbursement, and fund utilization tracking.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Default Credentials](#default-credentials)
- [Modules](#modules)
- [API Reference](#api-reference) | [Full Request/Response Schemas](./API_SCHEMAS.md)
- [User Roles and Permissions](#user-roles-and-permissions)
- [Workflow Process](#workflow-process)
- [Database Schema](#database-schema)
- [Frontend Architecture](#frontend-architecture)
- [Security](#security)
- [Deployment](#deployment)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Recent Changes](#recent-changes)

---

## Features

### Core Business Modules
- **Case Identification** — Pre-assessment eligibility screening with ITS integration, income assessment, and Jamiat/Jamaat filtering
- **Case Management** — Full lifecycle from registration to closure with status tracking, comments, and audit trails
- **Applicant Management** — Comprehensive profiles with personal details, family information, education, occupation, and ITS auto-fetch
- **Counseling Forms** — Multi-section digital forms covering personal details, family details, assessment, financial assistance, economic growth, declaration, attachments, and approval (Manzoori)
- **Cover Letters** — Automated cover letter generation with PDF export and submission workflows
- **Payment Management** — Payment schedules, quarterly/yearly repayment plans, installment tracking, and disbursement confirmation
- **Fund Utilization** — Dynamic quarterly reassessment reports with configurable form builder, photo documentation, and PDF export
- **Welfare Checklist** — Configurable checklist categories and items with completion tracking

### Workflow and Approval
- **Configurable Workflow Stages** — Multi-level approval pipelines per case type
- **Executive Approval Hierarchy** — Up to 5 levels of executive approval
- **Rework and Rejection** — Send cases back for revision at any stage
- **SLA Tracking** — Automated SLA calculations per workflow stage
- **Workflow Comments** — Stage-specific comments and audit trail

### Administration
- **Role-Based Access Control (RBAC)** — Granular permissions at resource + action level
- **User Management** — Create, edit, activate/deactivate users with multi-role support
- **Master Data** — Case types, relations, education levels, occupations, executive levels, workflow stages
- **Jamiat/Jamaat Hierarchy** — Organization and sub-organization management with scope-based access
- **Dashboard Analytics** — Role-specific dashboards with case statistics and pipeline views
- **Notifications** — In-app notifications for status changes, assignments, and SLA alerts
- **Reports** — PDF generation for quarterly reports and cover letters

### Integrations
- **ITS (Institutional Information System)** — Auto-fetch applicant data and photos by ITS number
- **Email Notifications** — SMTP-based email alerts for case status changes (optional)
- **Excel Import/Export** — Bulk import users, applicants, and Jamiat data from Excel files
- **PDF Generation** — PDFKit and Puppeteer-based report generation

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend** | Node.js + Express.js | v16+ / v4.18 |
| **Frontend** | React (functional components + hooks) | v18.2 |
| **Database** | MySQL (InnoDB) | v8.0+ |
| **Auth** | JWT + bcryptjs | jsonwebtoken v9 |
| **State Mgmt** | React Query | v3.39 |
| **Forms** | React Hook Form | v7.48 |
| **Styling** | Tailwind CSS | v3.4 |
| **HTTP Client** | Axios | v1.6 |
| **Routing** | React Router | v6 |
| **Charts** | Recharts | v2.8 |
| **File Upload** | Multer | v1.4 |
| **Email** | Nodemailer | v6.9 |
| **PDF** | PDFKit + Puppeteer | v0.14 / v24 |
| **Excel** | xlsx | v0.18 |
| **Validation** | Joi | v17.11 |
| **Security** | Helmet, CORS, express-rate-limit | - |
| **Drag & Drop** | @dnd-kit | - |
| **Signatures** | Custom SignaturePad component | - |

---

## Project Structure

```
FACTS/
├── backend/
│   ├── config/
│   │   └── database.js                 # MySQL connection pool (10 connections)
│   ├── middleware/
│   │   ├── auth.js                     # JWT auth, RBAC, scope filtering
│   │   └── permissionMiddleware.js     # Permission checking helpers
│   ├── routes/                         # 25 route files
│   │   ├── auth.js                     # Login, register, profile, password
│   │   ├── users.js                    # User CRUD, roles, import/export
│   │   ├── cases.js                    # Case CRUD, workflow, payments, closure
│   │   ├── applicants.js              # Applicant CRUD, ITS fetch, bulk ops
│   │   ├── caseIdentifications.js     # Eligibility screening, edit, revert
│   │   ├── counselingForms.js         # Multi-section form management
│   │   ├── coverLetters.js            # PDF generation, download
│   │   ├── coverLetterForms.js        # Cover letter form workflow
│   │   ├── fundUtilization.js         # Fund utilization reports
│   │   ├── fundUtilizationMaster.js   # Configurable sections/questions
│   │   ├── quarterlyReportPdf.js      # PDF report generation
│   │   ├── dashboard.js              # Analytics endpoints
│   │   ├── notifications.js          # Notification CRUD, mark read
│   │   ├── attachments.js            # File upload/download
│   │   ├── roles.js                  # Role CRUD, permission assignment
│   │   ├── permissions.js            # Permission checking
│   │   ├── workflowStages.js         # Configurable approval stages
│   │   ├── welfareChecklist.js        # Checklist categories/items/responses
│   │   ├── jamiat.js                 # Jamiat CRUD, import/export
│   │   ├── jamaat.js                 # Jamaat CRUD, by-jamiat filter
│   │   ├── caseTypes.js              # Case type master data
│   │   ├── relations.js              # Family relation types
│   │   ├── educationLevels.js        # Education level master
│   │   ├── occupations.js            # Occupation master
│   │   ├── executiveLevels.js        # Executive hierarchy
│   │   └── businessAssets.js         # Business asset tracking
│   ├── services/
│   │   ├── emailService.js           # SMTP email sending
│   │   └── notificationService.js    # In-app notification creation
│   ├── utils/
│   │   ├── activeCasePerIts.js       # Enforce one active case per ITS
│   │   ├── slaCalculator.js          # SLA calculation logic
│   │   ├── permissionUtils.js        # Permission helper functions
│   │   ├── roleUtils.js              # Role resolution utilities
│   │   ├── quarterlyReportPdfData.js # Report data aggregation
│   │   └── quarterlyReportPdfKit.js  # PDFKit report builder
│   ├── templates/
│   │   └── quarterlyReportPdfTemplate.js  # HTML template for Puppeteer
│   ├── scripts/
│   │   └── run-migration.js          # Migration runner
│   ├── uploads/                      # User-uploaded files
│   ├── index.js                      # Express server entry point
│   └── package.json
│
├── frontend/
│   ├── public/                       # Static assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/               # App layout wrapper
│   │   │   ├── ProtectedRoute.js     # Auth-guarded routes
│   │   │   ├── CounselingForm.js     # Multi-section counseling form
│   │   │   ├── CoverLetterForm.js    # Cover letter form
│   │   │   ├── FundUtilization*.js   # Fund utilization components
│   │   │   ├── PaymentSchedule.js    # Payment management
│   │   │   ├── WelfareChecklistForm.js  # Welfare checklist
│   │   │   ├── BusinessAssets.js     # Business asset tracking
│   │   │   ├── FileUpload.js         # File upload component
│   │   │   ├── SignaturePad.js       # Digital signature capture
│   │   │   ├── CaseSLAStatus.js      # SLA tracking display
│   │   │   ├── WorkflowComments.js   # Stage comments
│   │   │   └── ui/                   # 16 reusable UI components
│   │   │       ├── Button, Card, Modal, Table, Alert, Badge
│   │   │       ├── Input, Select, SearchableSelect, MultiSelect
│   │   │       ├── Pagination, Toast, Tabs, Spinner
│   │   │       └── WorkflowProgress
│   │   ├── pages/                    # 31 page components
│   │   │   ├── Login.js              # Authentication
│   │   │   ├── Dashboard.js          # Analytics dashboard
│   │   │   ├── Cases.js              # Case list with filters
│   │   │   ├── CaseDetails.js        # Case detail view
│   │   │   ├── CaseIdentification.js # Eligibility screening
│   │   │   ├── Applicants.js         # Applicant management
│   │   │   ├── Users.js              # User administration
│   │   │   ├── RoleManagement.js     # Role/permission editor
│   │   │   ├── JamiatMaster.js       # Jamiat/Jamaat management
│   │   │   ├── WorkflowStages.js     # Workflow configuration
│   │   │   ├── WelfareChecklist*.js   # Checklist admin
│   │   │   ├── FundUtilization*.js    # Fund utilization admin
│   │   │   ├── PaymentSchedulePage.js # Payment schedules
│   │   │   ├── Reports.js            # Reports
│   │   │   ├── Profile.js            # User profile
│   │   │   ├── Notifications.js      # Notification center
│   │   │   └── [Master data pages]   # CaseTypes, Relations, etc.
│   │   ├── contexts/
│   │   │   └── AuthContext.js        # Auth state management
│   │   ├── utils/
│   │   │   ├── permissionUtils.js    # usePermission hook
│   │   │   └── generateCoverLetterPDF.js  # Client-side PDF
│   │   ├── App.js                    # Router configuration
│   │   ├── theme.js                  # Theme config
│   │   └── index.css                 # Tailwind + global styles
│   ├── build/                        # Production build output
│   └── package.json
│
├── database/
│   ├── baaseteen_production_database.sql    # Consolidated production schema
│   └── migrations/                          # Individual migration files
│       ├── create_case_identification_income_logs_table.sql
│       ├── create_fund_utilization_tables.sql
│       ├── create_fund_utilization_master_tables.sql
│       ├── alter_fund_utilization_for_form_builder.sql
│       ├── seed_fund_utilization_sections_and_questions.sql
│       └── [additional migrations]
│
├── .env                              # Environment configuration
├── .gitignore
├── package.json                      # Root package with dev scripts
└── modules-list.txt                  # Module documentation
```

---

## Prerequisites

- **Node.js** v16 or higher
- **MySQL** v8.0 or higher
- **npm** v8 or higher

---

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd FACTS
```

### 2. Install Dependencies
```bash
# Install all dependencies (root + backend + frontend)
npm run install-all

# Or manually:
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 3. Database Setup
```bash
# Create the database
mysql -u root -p -e "CREATE DATABASE baaseteen_cms;"

# Import the production schema
mysql -u root -p baaseteen_cms < database/baaseteen_production_database.sql

# Verify
mysql -u root -p baaseteen_cms -e "SHOW TABLES;"
```

### 4. Apply Migrations (if needed)
Individual migrations in `database/migrations/` can be run for incremental updates:
```bash
mysql -u root -p baaseteen_cms < database/migrations/<migration_file>.sql
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
# ── Database ──────────────────────────────────────
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=baaseteen_cms

# ── JWT ───────────────────────────────────────────
JWT_SECRET=your_secret_key_min_32_characters
JWT_EXPIRES_IN=24h

# ── Server ────────────────────────────────────────
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# ── Email (Optional) ─────────────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@facts.com

# ── File Upload ───────────────────────────────────
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# ── Frontend ──────────────────────────────────────
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ENV=development

# ── Rate Limiting ─────────────────────────────────
LOGIN_RATE_LIMIT_SKIP_IPS=
```

---

## Running the Application

### Development
```bash
# Start both backend (port 5000) and frontend (port 3000) concurrently
npm run dev

# Or individually:
npm run backend     # Backend only with nodemon
npm run frontend    # Frontend only with React dev server
```

### Production
```bash
cd frontend && npm run build    # Build React app
cd ../backend && npm start      # Start Express server
```

---

## Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `admin` | `password` |

Change the default password immediately after first login.

---

## Modules

### 1. Case Identification
Pre-assessment eligibility screening. Users create case identification records with applicant details (auto-fetched from ITS), income assessment, and Jamiat/Jamaat assignment. Authorized reviewers can mark cases as eligible (auto-creates a case) or ineligible. Editors can modify assessment fields and revert ineligible cases back to pending.

**Key capabilities:**
- ITS number auto-lookup for applicant data and photo
- Duplicate ITS detection
- Eligible In (case type) assignment
- Income and family member assessment
- Eligible/Ineligible review with remarks
- Edit assessment fields with income audit logging
- Revert ineligible to pending
- Searchable Jamiat/Jamaat filters with cascading

### 2. Case Management
Core module for managing welfare cases through their entire lifecycle. Cases are created either manually or automatically from case identification. Each case goes through configurable workflow stages with multi-level approvals.

**Key capabilities:**
- Case CRUD with case number generation (e.g., BS-0001)
- Case assignment to DCM and counselor
- Multi-stage workflow (Draft, Counseling, Welfare Review, ZI Approval, KG Review, Operations Lead, Cover Letter, Executive Approval, Manzoori, Financial Disbursement)
- Workflow actions: approve, reject, rework, resubmit
- Case comments and workflow stage comments
- SLA tracking per stage
- Case closure with document upload
- Payment schedule management
- Financial assistance tracking (financial, economic growth, enayat, non-financial)

### 3. Applicant Management
Comprehensive applicant profiles with personal details, family information, education, occupation, and document management. Supports ITS integration for auto-populating applicant data.

**Key capabilities:**
- Full applicant profiles (personal, family, contact, address)
- ITS number integration with external API
- Photo management
- Bulk import from Excel
- Bulk fetch from ITS API
- Export template download
- One active case per ITS enforcement

### 4. Counseling Forms
Multi-section digital counseling forms that replace paper-based counseling. Forms are linked to cases and go through their own completion workflow.

**Sections:**
1. Personal Details
2. Family Details
3. Assessment
4. Financial Assistance
5. Economic Growth
6. Declaration
7. Attachments
8. Manzoori (Approval)

**Key capabilities:**
- Section-by-section editing and saving
- Digital signature capture
- File attachments per section
- Form completion tracking
- Counselor and DCM role-specific access

### 5. Cover Letters
Automated cover letter generation for cases. Cover letter forms collect additional information and generate PDF documents for executive review.

**Key capabilities:**
- Cover letter form with submission workflow
- Automated PDF generation via Puppeteer
- Download and print support
- Save-before-submit UX — Save keeps the modal open (shows toast confirmation); Submit is disabled with helper text until unsaved changes are saved
- PDF downloaded fresh from current data via the preview endpoint (not a stored static file)
- Toast notifications rendered at `document.body` level via `ReactDOM.createPortal` to prevent z-index conflicts with the header

**PDF layout:**
- Section labels (Summary of Proposed Upliftment Plan, Financial Assistance, Non-financial Assistance, Projected Income) use 20% width to align with the Welfare Dept Comments style
- Executive Management section has `page-break-inside: avoid` to prevent it from splitting across pages
- Executive Approval section rendered as a table with columns (Enayat, Qardan, QH Months) matching the Financial Assistance table style

### 6. Payment Management
Track financial disbursements for approved cases. Payment schedules define installment plans and track actual disbursements.

**Key capabilities:**
- Create payment schedules (quarterly/yearly)
- Monthly installment tracking
- Disbursement confirmation with dates
- Payment status tracking

### 7. Fund Utilization
Dynamic quarterly reassessment system to track how disbursed funds are being utilized. Built with a configurable form builder so administrators can define custom sections and questions.

**Key capabilities:**
- Quarterly fund utilization reports per case
- Dynamic form builder (admin-configurable sections and questions)
- Question types: text, number, select, file upload, table
- Photo documentation of fund usage
- Auto-fill for known fields (e.g., Mauze from applicant data)
- PDF report generation with signatures

### 8. Welfare Checklist
Configurable checklists for welfare assessment. Administrators define categories and items; field workers complete checklists per case.

**Key capabilities:**
- Category and item management
- Drag-and-drop reordering
- Per-case checklist completion
- Status tracking (pending/completed)

### 9. Workflow Management
Configurable approval workflows that define how cases move through stages. Each case type can have different workflow configurations.

**Key capabilities:**
- Configurable stages per case type
- Role and user assignment to stages
- Stage ordering with drag-and-drop
- Status mappings per stage
- Soft delete and restore

### 10. Dashboard and Analytics
Role-specific dashboards providing overview statistics, case pipeline views, and recent activity feeds.

**Key capabilities:**
- Total cases, pending, approved, closed counts
- Case pipeline by status
- Recent activities feed
- Role-filtered views

### 11. Notifications
In-app notification system for case status changes, assignments, and SLA alerts.

**Key capabilities:**
- Real-time notification count
- Mark as read (individual and bulk)
- SLA check trigger
- Notification history

### 12. Reports
Reporting module with PDF export capabilities for quarterly reports and case summaries.

### 13. User and Role Management
Complete RBAC system with granular permissions at the resource + action level.

**Resources (15):** users, cases, applicants, counseling_forms, comments, payment_management, cover_letters, cover_letter_forms, notifications, reports, roles, dashboard, welfare_checklist, master, case_identification

**Actions per resource:** create, read, update, delete, approve, edit, fill, view, close_case, submit, read_comments, write_comments (varies by resource)

### 14. Master Data
Administrative configuration tables: Case Types, Relations, Education Levels, Occupations, Executive Levels, Workflow Stages, Jamiat, Jamaat.

---

## API Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/login` | No | Login with username/email + password |
| POST | `/register` | Yes | Register new user |
| GET | `/profile` | Yes | Get current user profile |
| PUT | `/profile` | Yes | Update profile |
| PUT | `/change-password` | Yes | Change password |
| POST | `/logout` | Yes | Logout |

### Users (`/api/users`)
| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | users:read | List all users |
| GET | `/roles` | Auth | Get available roles |
| GET | `/me` | Auth | Current user details |
| PATCH | `/me/primary-role` | Auth | Switch active role |
| GET | `/by-role/:role` | Auth | Users filtered by role |
| GET | `/:userId` | users:read | Get user by ID |
| POST | `/` | users:create | Create user |
| PUT | `/:userId` | users:update | Update user |
| PUT | `/:userId/toggle-status` | users:update | Activate/deactivate |
| PUT | `/:id/status` | users:update | Update status |
| PUT | `/:userId/assign-executive-level` | Admin | Assign executive level |
| DELETE | `/:userId` | users:delete | Delete user |
| GET | `/export/template` | users:read | Download Excel template |
| POST | `/import-excel` | users:create | Import from Excel |
| POST | `/fetch-contact-from-api` | users:update | Fetch from ITS API |
| GET | `/stats/overview` | Admin/DCM | User statistics |

### Cases (`/api/cases`)
| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | cases:read | List cases (filtered, paginated) |
| GET | `/:caseId` | Case access | Get case details |
| POST | `/` | cases:create | Create new case |
| PUT | `/:caseId` | Case access | Update case |
| DELETE | `/:caseId` | cases:delete | Delete case |
| GET | `/its/:itsNumber/active` | Auth | Check active case by ITS |
| GET | `/available-counselors` | Auth | List available counselors |
| GET | `/counselor-permissions/:id` | cases:read | Counselor permissions |
| PUT | `/:caseId/welfare-approve` | Auth | Welfare approval |
| PUT | `/:caseId/welfare-reject` | Auth | Welfare rejection |
| PUT | `/:caseId/welfare-forward-rework` | Auth | Forward for rework |
| PUT | `/:caseId/resubmit-welfare` | Auth | Resubmit after rework |
| PUT | `/:caseId/zi-approve` | Auth | ZI approval |
| PUT | `/:caseId/zi-reject` | Auth | ZI rejection |
| PUT | `/:caseId/executive-approve` | Auth | Executive approval |
| PUT | `/:caseId/executive-rework` | Auth | Executive rework |
| PUT | `/:caseId/workflow-action` | Auth | Generic workflow action |
| GET | `/:caseId/comments` | comments:read_comments | Get case comments |
| POST | `/:caseId/comments` | comments:write_comments | Add comment |
| GET | `/:caseId/workflow-comments/:step` | comments:read_comments | Workflow step comments |
| POST | `/:caseId/workflow-comments` | comments:write_comments | Add workflow comment |
| GET | `/:caseId/payment-schedule` | Case access | Get payment schedule |
| POST | `/:caseId/payment-schedule` | Case access | Create payment schedule |
| POST | `/:caseId/payment-schedule/:id/confirm-disbursement` | Case access | Confirm payment |
| POST | `/:caseId/close` | cases:close_case | Close case with docs |
| GET | `/:caseId/closure` | Auth | Get closure details |
| GET | `/:caseId/closure/document` | Auth | Closure document |
| GET | `/:caseId/closure/documents/:docId` | Auth | Download closure doc |
| GET | `/status-diagnostics` | Admin | Status diagnostics |

### Case Identifications (`/api/case-identifications`)
| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | case_identification:read | List with filters (search, status, eligible_in, jamiat, jamaat) |
| GET | `/check-its/:itsNumber` | Auth | Check if ITS already exists |
| GET | `/:id` | case_identification:read | Get single record |
| POST | `/` | case_identification:create | Create new identification |
| PUT | `/:id/review` | case_identification:approve | Mark eligible/ineligible |
| PUT | `/:id/edit` | case_identification:edit | Edit assessment fields |
| PUT | `/:id/revert-to-pending` | case_identification:edit | Revert ineligible to pending |

### Applicants (`/api/applicants`)
| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | applicants:read | List applicants |
| GET | `/:applicantId` | applicants:read | Get applicant |
| GET | `/lookup/:itsNumber` | Auth | Lookup by ITS |
| GET | `/fetch-from-api/:itsNumber` | Public | Fetch from ITS API |
| POST | `/` | applicants:create | Create applicant |
| PUT | `/:applicantId` | applicants:update | Update applicant |
| DELETE | `/:applicantId` | applicants:delete | Delete applicant |
| GET | `/meta/unique-values` | Auth | Unique meta values |
| GET | `/meta/pending-count` | Auth | Pending count |
| POST | `/bulk-import` | applicants:create | Bulk import |
| POST | `/bulk-fetch` | applicants:update | Bulk ITS fetch |
| POST | `/import-excel` | applicants:create | Import from Excel |
| GET | `/export-template` | Auth | Download template |

### Counseling Forms (`/api/counseling-forms`)
| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/case/:caseId` | Case access | Get form for case |
| PUT | `/:formId/section/:section` | Auth | Update form section |
| PUT | `/:formId/complete` | Auth | Mark form complete |

### Cover Letters (`/api/cover-letters`)
| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/generate/:caseId` | Case access | Generate cover letter |
| GET | `/case/:caseId` | Case access | Get for case |
| GET | `/download/:coverLetterId` | Auth | Download PDF |

### Cover Letter Forms (`/api/cover-letter-forms`)
| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/case/:caseId` | Case access | Get form |
| POST | `/case/:caseId` | Case access | Create/update form |
| PUT | `/:formId/submit` | cover_letter_forms:submit | Submit form |

### Dashboard (`/api/dashboard`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/overview` | Yes | Overview statistics |
| GET | `/recent-activities` | Yes | Recent activities |
| GET | `/case-pipeline` | Yes | Case pipeline by status |

### Notifications (`/api/notifications`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Yes | List notifications |
| PUT | `/:id/read` | Yes | Mark as read |
| PUT | `/mark-all-read` | Yes | Mark all read |
| GET | `/unread-count` | Yes | Unread count |
| DELETE | `/:id` | Yes | Delete notification |
| POST | `/check-sla` | Yes | Trigger SLA check |

### Attachments (`/api/attachments`)
| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/upload/:caseId` | Case access | Upload single file |
| POST | `/upload-multiple/:caseId` | Case access | Upload multiple (max 10) |
| GET | `/case/:caseId` | Case access | List files for case |
| GET | `/download/:attachmentId` | Auth | Download file |
| DELETE | `/:attachmentId` | Auth | Delete file |
| GET | `/stats/:caseId` | Case access | Upload statistics |

### Roles (`/api/roles`)
| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | Auth | List roles |
| GET | `/:id` | Super Admin | Get role details |
| POST | `/` | Super Admin | Create role |
| PUT | `/:id` | Super Admin | Update role |
| DELETE | `/:id` | Super Admin | Delete role |
| GET | `/permissions/available` | Super Admin | Available permissions list |
| POST | `/:id/assign` | Super Admin | Assign user to role |
| DELETE | `/:id/unassign/:userId` | Super Admin | Unassign user |
| GET | `/stats/overview` | Super Admin | Role statistics |

### Permissions (`/api/permissions`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/check` | Yes | Check specific permission |
| GET | `/counseling-form-access` | Yes | Form access check |
| GET | `/counseling-form-roles` | Yes | Form role config |
| GET | `/admin-roles` | Yes | Admin role list |
| GET | `/summary` | Yes | Permission summary |

### Master Data

All master data endpoints follow the same pattern:

| Resource | Base URL | Actions |
|----------|----------|---------|
| Jamiat | `/api/jamiat` | CRUD + import/export Excel |
| Jamaat | `/api/jamaat` | CRUD + filter by jamiat |
| Case Types | `/api/case-types` | CRUD |
| Relations | `/api/relations` | CRUD |
| Education Levels | `/api/education-levels` | CRUD |
| Occupations | `/api/occupations` | CRUD |
| Executive Levels | `/api/executive-levels` | CRUD + reorder + active list |
| Business Assets | `/api/business-assets` | GET/POST/DELETE per case |

### Workflow Stages (`/api/workflow-stages`)
| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | master:read | List all stages |
| GET | `/by-case-type` | master:read | Stages by case type |
| GET | `/status-mappings` | master:read | Status mappings |
| GET | `/:id` | master:read | Get stage |
| POST | `/` | master:create | Create stage |
| PUT | `/:id` | master:update | Update stage |
| DELETE | `/:id` | master:delete | Soft delete stage |
| PUT | `/:id/restore` | master:update | Restore deleted stage |
| PUT | `/reorder` | master:update | Reorder stages |
| POST/DELETE | `/:id/roles` | master:create/delete | Manage stage roles |
| POST/DELETE | `/:id/users` | master:create/delete | Manage stage users |
| GET | `/available/roles` | master:read | Available roles |
| GET | `/available/users` | master:read | Available users |

### Welfare Checklist (`/api/welfare-checklist`)
| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET/POST/PUT/DELETE | `/categories` | Admin | Category management |
| PUT | `/categories/reorder` | Super Admin | Reorder categories |
| GET/POST/PUT/DELETE | `/items` | Admin | Item management |
| GET | `/items/grouped` | Auth | Items grouped by category |
| GET | `/responses/:caseId` | Auth | Get responses for case |
| POST | `/responses/:caseId` | Auth | Submit responses |
| GET | `/status/:caseId` | Auth | Completion status |

### Fund Utilization
| Resource | Base URL | Description |
|----------|----------|-------------|
| Reports | `/api/cases/:caseId/fund-utilization` | CRUD for fund utilization reports |
| Sections | `/api/fund-utilization-master/sections` | CRUD + reorder |
| Questions | `/api/fund-utilization-master/questions` | CRUD + reorder |

---

## User Roles and Permissions

### Built-in Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Super Admin** | Full system access | All resources, all actions |
| **Admin** | Administrative functions | User mgmt, master data, case oversight |
| **DCM** (Deputy Case Manager) | Case management lead | Case CRUD, assignment, counseling, cover letters |
| **Counselor** | Counseling form management | Counseling form editing, case viewing |
| **Welfare Reviewer** | Case review and approval | Welfare approve/reject, checklist review |
| **Executive** | Multi-level approval | Executive approve/rework by assigned level |
| **Finance** | Financial operations | Payment tracking, disbursement confirmation |
| **Report Viewer** | Read-only reports | Reports access only |

### Permission Model

Permissions are defined as `resource:action` pairs. Example:
- `cases:create` — Can create cases
- `case_identification:approve` — Can mark cases eligible/ineligible
- `case_identification:edit` — Can edit assessment fields and revert to pending
- `master:update` — Can modify master data

### Scope Restrictions
- **Jamiat scope** — Approve users only see cases from their assigned Jamiat(s)
- **Jamaat scope** — Filling users only see cases from their assigned Jamaat(s)
- **Super Admin / Admin** — No scope restrictions (see all data)

---

## Workflow Process

```
┌─────────────────┐
│ Case             │
│ Identification   │──── Eligible ───→ Case Auto-Created
│ (Screening)      │
└─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────┐    ┌──────────────┐
│ Draft Stage      │───→│ Counseling   │───→│ Welfare      │
│ (DCM assigns)   │    │ Form Fill    │    │ Review       │
└─────────────────┘    └──────────────┘    └──────────────┘
                                                  │
         ┌────────────────────────────────────────┘
         ▼
┌─────────────────┐    ┌──────────────┐    ┌──────────────┐
│ ZI Approval      │───→│ KG Review    │───→│ Operations   │
│                  │    │              │    │ Lead         │
└─────────────────┘    └──────────────┘    └──────────────┘
                                                  │
         ┌────────────────────────────────────────┘
         ▼
┌─────────────────┐    ┌──────────────┐    ┌──────────────┐
│ Cover Letter     │───→│ Executive    │───→│ Manzoori     │
│ Generation       │    │ Approval     │    │ (Sanction)   │
│                  │    │ (Multi-level)│    │              │
└─────────────────┘    └──────────────┘    └──────────────┘
                                                  │
         ┌────────────────────────────────────────┘
         ▼
┌─────────────────┐    ┌──────────────┐    ┌──────────────┐
│ Financial        │───→│ Payment      │───→│ Fund         │
│ Disbursement     │    │ Schedule     │    │ Utilization  │
│                  │    │ Tracking     │    │ (Quarterly)  │
└─────────────────┘    └──────────────┘    └──────────────┘
                                                  │
                                                  ▼
                                           ┌──────────────┐
                                           │ Case Closure  │
                                           └──────────────┘
```

At any approval stage, cases can be **rejected** or sent for **rework**, returning them to a previous stage.

---

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts with credentials and contact info |
| `roles` | Role definitions |
| `user_roles` | User-to-role assignments with Jamiat/Jamaat scope |
| `role_permissions` | Permission assignments per role |
| `cases` | Main case records with status, assignment, workflow |
| `applicants` | Applicant profiles with personal/family details |
| `case_identifications` | Pre-assessment eligibility records |
| `case_identification_income_logs` | Audit log for income field changes |
| `counseling_forms` | Multi-section counseling form data |
| `counseling_form_stages` | Form stage completion tracking |
| `cover_letters` | Generated cover letter records |
| `cover_letter_forms` | Cover letter form submissions |
| `workflow_stages` | Configurable approval stage definitions |
| `workflow_logs` | Workflow action audit trail |
| `executive_levels` | Executive approval hierarchy |
| `notifications` | In-app notification records |
| `attachments` | File upload metadata |
| `payment_schedules` | Payment plan records |
| `financial_assistance` | Financial support tracking |

### Master Data Tables

| Table | Description |
|-------|-------------|
| `jamiat` | Jamiat organizations |
| `jamaat` | Jamaat sub-organizations (FK to jamiat) |
| `case_types` | Case classification types |
| `relations` | Family relationship types |
| `education_levels` | Education level options |
| `occupations` | Occupation master data |

### Welfare and Fund Tables

| Table | Description |
|-------|-------------|
| `welfare_checklist_categories` | Checklist category definitions |
| `welfare_checklist_items` | Individual checklist items |
| `welfare_checklist_responses` | Per-case checklist responses |
| `fund_utilization_reports` | Quarterly fund usage reports |
| `fund_utilization_sections` | Configurable form sections |
| `fund_utilization_questions` | Dynamic form questions |
| `fund_utilization_responses` | Question responses per report |
| `business_assets` | Business asset inventory per case |

---

## Frontend Architecture

### State Management
- **Server State**: React Query manages all API data with automatic caching, refetching, and optimistic updates
- **Auth State**: React Context (`AuthContext`) for user session, token, and permissions
- **Form State**: React Hook Form for all form inputs with validation
- **Local State**: useState for UI state (modals, filters, pagination)

### Route Protection
Routes are protected using multiple strategies defined in `App.js`:
- `requireAdminAccess` — Admin or Super Admin only
- `requiredPermission(resource, action)` — Specific permission check
- `requiredAnyOfPermissions([...])` — Any of multiple permissions
- `requireRoles([...])` — Specific role check
- `requireCounselingFormAccess` — Counseling form access

### UI Component Library
Custom reusable components in `frontend/src/components/ui/`:
- Layout: Button, Card, Modal, Tabs, Spinner
- Data: Table, Pagination, Badge, Alert, Toast
- Form: Input, Select, SearchableSelect, MultiSelect
- Domain: WorkflowProgress

---

## Security

| Feature | Implementation |
|---------|---------------|
| Authentication | JWT tokens (24h expiry) |
| Password Storage | bcryptjs hashing |
| API Security | Helmet HTTP headers |
| CORS | Configured for frontend origin |
| Rate Limiting | Login endpoint rate limiting |
| Input Validation | Joi schema validation |
| SQL Protection | Parameterized queries (mysql2) |
| File Upload | Type and size validation (Multer) |
| RBAC | Resource + action permission checks |
| Scope Isolation | Jamiat/Jamaat organizational scoping |
| Token Verification | User status checked on each request |

---

## Deployment

### Production with PM2 (Recommended)

```bash
# 1. Build frontend
cd frontend && npm run build

# 2. Configure production .env
# Set NODE_ENV=production, strong JWT_SECRET, production DB credentials

# 3. Start with PM2
cd backend
pm2 start index.js --name facts-backend
pm2 save
pm2 startup
```

### Production with systemd

```ini
# /etc/systemd/system/facts.service
[Unit]
Description=FACTS Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/FACTS/backend
ExecStart=/usr/bin/node index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable facts
sudo systemctl start facts
```

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.crt;
    ssl_certificate_key /path/to/key.key;

    # Frontend (React build)
    location / {
        root /var/www/FACTS/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # File uploads
    location /uploads {
        proxy_pass http://localhost:5000/uploads;
    }

    client_max_body_size 10M;
}
```

### Post-Deployment Checklist

- [ ] Database imported and verified
- [ ] Environment variables configured (strong JWT secret)
- [ ] Frontend built (`npm run build`)
- [ ] Backend running (PM2 or systemd)
- [ ] Nginx configured with SSL
- [ ] Default admin password changed
- [ ] Upload directory has write permissions
- [ ] Database backups scheduled
- [ ] Firewall configured (ports 80, 443, 22 only)

---

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

---

## Monitoring

- **Health Check**: `GET /health` — Returns server status
- **Error Logging**: Console-based error logging with stack traces
- **Audit Trails**: Workflow logs, income change audit, status history
- **SLA Monitoring**: Automated SLA calculation per workflow stage

---

## Recent Changes

### Cover Letter Improvements (March 2026)

**PDF Template (`backend/templates/coverLetterPdfTemplate.js`)**
- Standardized section label widths to 20% (Summary of Proposed Upliftment Plan, Financial Assistance, Non-financial Assistance, Projected Income) to match the Welfare Dept Comments style
- Added `page-break-inside: avoid` on the Executive Management section to prevent it from splitting across pages
- Removed "Cover letter prepared by System" footer text from generated PDFs
- Converted Executive Approval section from flat inline layout to a table (columns: Enayat, Qardan, QH Months), consistent with the Financial Assistance table style

**Cover Letter Form UX (`frontend/src/components/CoverLetterForm.js`)**
- Save button no longer closes the modal — it saves and shows a toast, keeping the form open for review
- Added `hasUnsavedChanges` state: Submit button is disabled with helper text "Save changes before submitting" whenever there are unsaved edits

**Toast & PDF Download (`frontend/src/pages/Cases.js`)**
- Toast notifications moved to `document.body` via `ReactDOM.createPortal` with `z-index: 9999`, preventing them from being obscured by the app header
- PDF download now uses the preview endpoint (`/api/cover-letters/preview/:caseId`) to generate a fresh PDF from current data instead of retrieving a previously saved static file

---

## License

This project is licensed under the MIT License.

---

**FACTS** — Streamlining welfare case management for better social impact.
