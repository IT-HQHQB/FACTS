# FACTS API - Request & Response Schema Reference

Complete request/response schema documentation for every API endpoint in the FACTS system.

---

## Table of Contents

- [Authentication](#1-authentication-apiauth)
- [Users](#2-users-apiusers)
- [Cases](#3-cases-apicases)
- [Case Identifications](#4-case-identifications-apicase-identifications)
- [Applicants](#5-applicants-apiapplicants)
- [Counseling Forms](#6-counseling-forms-apicounseling-forms)
- [Cover Letters](#7-cover-letters-apicover-letters)
- [Cover Letter Forms](#8-cover-letter-forms-apicover-letter-forms)
- [Roles](#9-roles-apiroles)
- [Permissions](#10-permissions-apipermissions)
- [Dashboard](#11-dashboard-apidashboard)
- [Notifications](#12-notifications-apinotifications)
- [Attachments](#13-attachments-apiattachments)
- [Workflow Stages](#14-workflow-stages-apiworkflow-stages)
- [Welfare Checklist](#15-welfare-checklist-apiwelfare-checklist)
- [Fund Utilization](#16-fund-utilization-apicasescaseidfund-utilization)
- [Fund Utilization Master](#17-fund-utilization-master-apifund-utilization-master)
- [Quarterly Report PDF](#18-quarterly-report-pdf-apicasescaseidquarterly-report)
- [Jamiat](#19-jamiat-apijamiat)
- [Jamaat](#20-jamaat-apijamaat)
- [Case Types](#21-case-types-apicase-types)
- [Relations](#22-relations-apirelations)
- [Education Levels](#23-education-levels-apieducation-levels)
- [Occupations](#24-occupations-apioccupations)
- [Executive Levels](#25-executive-levels-apiexecutive-levels)
- [Business Assets](#26-business-assets-apibusiness-assets)

---

## 1. Authentication (`/api/auth`)

### POST `/login`
Authenticate user with username/email and password.

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "string (JWT)",
  "user": {
    "id": "number",
    "username": "string",
    "email": "string",
    "full_name": "string",
    "role": "string",
    "is_active": "number (0|1)",
    "executive_level": "number|null"
  }
}
```

**Errors:**
- 400: `{ "error": "Username and password are required" }`
- 401: `{ "error": "Invalid credentials" }`

---

### POST `/register`
Create new user (admin only).

**Auth:** Required | **Role:** Admin

**Request Body:**
```json
{
  "username": "string (required)",
  "email": "string (required)",
  "password": "string (required)",
  "full_name": "string (required)",
  "role": "string (required)"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "userId": "number"
}
```

**Errors:**
- 400: `{ "error": "All fields are required" }`
- 403: `{ "error": "Only administrators can create new users" }`
- 409: `{ "error": "Username or email already exists" }`

---

### GET `/profile`
Get current user's profile with permissions.

**Auth:** Required

**Response (200):**
```json
{
  "user": {
    "id": "number",
    "username": "string",
    "email": "string",
    "full_name": "string",
    "role": "string",
    "is_active": "number (0|1)",
    "executive_level": "number|null",
    "created_at": "datetime",
    "permissions": {
      "resource_name": ["action1", "action2"]
    }
  }
}
```

---

### PUT `/profile`
Update current user's profile.

**Auth:** Required

**Request Body:**
```json
{
  "full_name": "string (optional)",
  "email": "string (optional)"
}
```

**Response (200):**
```json
{
  "message": "Profile updated successfully"
}
```

---

### PUT `/change-password`
Change current user's password.

**Auth:** Required

**Request Body:**
```json
{
  "currentPassword": "string (required)",
  "newPassword": "string (required, min 6 chars)"
}
```

**Response (200):**
```json
{
  "message": "Password changed successfully"
}
```

**Errors:**
- 401: `{ "error": "Current password is incorrect" }`

---

### POST `/logout`
Logout current user.

**Auth:** Required

**Response (200):**
```json
{
  "message": "Logout successful"
}
```

---

## 2. Users (`/api/users`)

### GET `/`
List all users with filtering and pagination.

**Auth:** Required | **Permission:** `assign_case` or admin role

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `role` | string | - | Filter by role name |
| `is_active` | string | - | `"true"` or `"false"` |
| `search` | string | - | Search in full_name, username, email |
| `jamiat_id` | number | - | Filter by jamiat |
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Results per page (10, 20, 50, 100, 500) |

**Response (200):**
```json
{
  "users": [
    {
      "id": "number",
      "username": "string",
      "email": "string",
      "full_name": "string",
      "role": "string",
      "is_active": "number (0|1)",
      "phone": "string|null",
      "its_number": "string|null",
      "photo": "string|null",
      "executive_level": "number|null",
      "created_at": "datetime",
      "updated_at": "datetime",
      "assigned_roles": [
        {
          "role_id": "number|null",
          "name": "string",
          "jamiat": [
            { "id": "number", "name": "string", "jamiat_id": "string|null" }
          ],
          "jamaat": [
            { "id": "number", "name": "string", "jamaat_id": "string|null", "jamiat_name": "string" }
          ]
        }
      ],
      "jamiat": [],
      "jamaat": []
    }
  ],
  "total": "number",
  "page": "number",
  "limit": "number",
  "totalPages": "number"
}
```

---

### POST `/`
Create new user.

**Auth:** Required | **Permission:** `users:create`

**Request Body:**
```json
{
  "full_name": "string (required)",
  "username": "string (required, 3-30 chars)",
  "email": "string (required)",
  "phone": "string (optional)",
  "its_number": "string (optional)",
  "jamiat": "[number] (optional, array of jamiat IDs)",
  "jamaat": "[number] (optional, array of jamaat IDs)",
  "role": "string|[string] (required, role name(s))",
  "role_jamiat_jamaat": {
    "roleName": {
      "jamiat": [1, 2],
      "jamaat": [3]
    }
  },
  "is_active": "boolean (optional, default: true)",
  "password": "string (optional, default: 'TempPassword123!')",
  "photo": "string (optional, base64)"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "userId": "number",
  "username": "string"
}
```

---

### GET `/roles`
Get all active roles.

**Auth:** Required

**Response (200):**
```json
{
  "roles": [
    { "id": "number", "name": "string", "is_active": "number" }
  ]
}
```

---

### GET `/me`
Get current user with assigned roles.

**Auth:** Required

**Response (200):**
```json
{
  "user": {
    "id": "number",
    "username": "string",
    "email": "string",
    "full_name": "string",
    "role": "string",
    "is_active": "number (0|1)",
    "phone": "string|null",
    "its_number": "string|null",
    "photo": "string|null",
    "executive_level": "number|null",
    "created_at": "datetime",
    "updated_at": "datetime",
    "assigned_roles": [
      { "id": "number", "name": "string" }
    ]
  }
}
```

---

### PATCH `/me/primary-role`
Set current user's primary display role.

**Auth:** Required

**Request Body:**
```json
{
  "role": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "role": "string"
}
```

---

### GET `/by-role/:role`
Get users filtered by role.

**Auth:** Required

**URL Params:** `role` (string)

**Response (200):**
```json
{
  "users": [
    { "id": "number", "full_name": "string", "username": "string", "email": "string" }
  ]
}
```

---

### GET `/:userId`
Get single user by ID.

**Auth:** Required | **Permission:** `users:read`

**Response (200):**
```json
{
  "user": {
    "id": "number",
    "username": "string",
    "email": "string",
    "full_name": "string",
    "role": "string",
    "is_active": "number (0|1)",
    "phone": "string|null",
    "its_number": "string|null",
    "photo": "string|null",
    "executive_level": "number|null",
    "created_at": "datetime",
    "updated_at": "datetime",
    "assigned_roles": [
      {
        "role_id": "number|null",
        "name": "string",
        "jamiat": [{ "id": "number", "name": "string", "jamiat_id": "string|null" }],
        "jamaat": [{ "id": "number", "name": "string", "jamaat_id": "string|null", "jamiat_name": "string" }]
      }
    ],
    "jamiat": [],
    "jamaat": []
  }
}
```

---

### PUT `/:userId`
Update user information.

**Auth:** Required | **Permission:** `users:update`

**Request Body:**
```json
{
  "full_name": "string (optional)",
  "username": "string (optional)",
  "email": "string (optional)",
  "phone": "string (optional)",
  "its_number": "string (optional)",
  "jamiat": "[number] (optional)",
  "jamaat": "[number] (optional)",
  "role": "string|[string] (optional)",
  "role_jamiat_jamaat": "object (optional)",
  "is_active": "number (optional, 0|1)",
  "password": "string (optional, min 6 chars)",
  "photo": "string (optional, base64)"
}
```

**Response (200):**
```json
{
  "message": "User updated successfully"
}
```

---

### PUT `/:userId/toggle-status`
Toggle user active/inactive status.

**Auth:** Required | **Permission:** `users:update`

**Response (200):**
```json
{
  "message": "User status updated successfully"
}
```

---

### PUT `/:id/status`
Explicitly set user status.

**Auth:** Required | **Permission:** `users:update`

**Request Body:**
```json
{
  "is_active": "number (required, 0|1)"
}
```

**Response (200):**
```json
{
  "message": "User status updated successfully"
}
```

---

### PUT `/:userId/assign-executive-level`
Assign executive level to user.

**Auth:** Required | **Role:** super_admin or admin

**Request Body:**
```json
{
  "executive_level": "number|null (required)"
}
```

**Response (200):**
```json
{
  "message": "User {full_name} has been assigned to executive level {level}",
  "user": {
    "id": "number",
    "full_name": "string",
    "executive_level": "number|null"
  }
}
```

---

### DELETE `/:userId`
Delete user permanently.

**Auth:** Required | **Permission:** `users:delete`

**Response (200):**
```json
{
  "message": "User deleted successfully"
}
```

---

### GET `/stats/overview`
Get user statistics.

**Auth:** Required | **Role:** admin, dcm, ZI

**Response (200):**
```json
{
  "stats": {
    "total_users": "number",
    "active_users": "number",
    "inactive_users": "number",
    "{role_name}_count": "number"
  }
}
```

---

### GET `/export/template`
Download Excel template for user import.

**Auth:** Required | **Permission:** `users:read`

**Response:** Excel file (`users_import_template.xlsx`)

---

### POST `/import-excel`
Import users from Excel file.

**Auth:** Required | **Permission:** `users:create`

**Request:** Multipart form data with `file` (Excel .xlsx/.xls)

**Response (200):**
```json
{
  "success": true,
  "inserted": "number",
  "updated": "number",
  "skipped": "number",
  "total": "number",
  "errors": ["Row X: Error message"]
}
```

---

### POST `/fetch-contact-from-api`
Fetch contact details from external ITS API for users with given role.

**Auth:** Required | **Permission:** `users:update`

**Request Body:**
```json
{
  "role": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "updated": "number",
  "failed": "number",
  "total": "number",
  "errors": ["ITS {its_number} ({username}): Error message"]
}
```

---

## 3. Cases (`/api/cases`)

### GET `/`
List cases with filtering and pagination.

**Auth:** Required | **Permission:** `cases:read`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Results per page |
| `status` | string | - | Filter by case status |
| `case_type` | string | - | Filter by case type name |
| `case_type_id` | number | - | Filter by case type ID |
| `assigned_roles` | number | - | Filter by assigned DCM user ID |
| `assigned_counselor_id` | number | - | Filter by counselor ID |
| `search` | string | - | Search by name, ITS, or case number |
| `jamiat_id` | number | - | Filter by Jamiat |
| `jamaat_id` | number | - | Filter by Jamaat |
| `current_workflow_stage_id` | number | - | Filter by workflow stage |
| `is_duplicate` | string | - | Filter duplicates (`"1"` or `"true"`) |

**Response (200):**
```json
{
  "cases": [
    {
      "id": "number",
      "case_number": "string",
      "applicant_id": "number",
      "case_type_id": "number",
      "status": "string",
      "roles": "number (DCM user ID)",
      "assigned_counselor_id": "number",
      "jamiat_id": "number",
      "jamaat_id": "number",
      "created_by": "number",
      "created_at": "datetime",
      "updated_at": "datetime",
      "current_workflow_stage_id": "number",
      "workflow_history": "string (JSON)",
      "applicant_full_name": "string",
      "its_number": "string",
      "roles_full_name": "string",
      "counselor_full_name": "string",
      "created_by_full_name": "string",
      "counseling_form_completed": "boolean",
      "cover_letter_form_exists": "boolean",
      "cover_letter_form_completed": "boolean",
      "cover_letter_form_approved": "boolean",
      "personal_details_completed": "boolean",
      "family_details_completed": "boolean",
      "assessment_completed": "boolean",
      "financial_assistance_completed": "boolean",
      "economic_growth_completed": "boolean",
      "declaration_completed": "boolean",
      "attachments_completed": "boolean",
      "all_sections_completed": "boolean",
      "manzoori_file_count": "number",
      "jamiat_name": "string",
      "jamaat_name": "string",
      "case_type_name": "string",
      "status_name": "string",
      "current_workflow_stage_name": "string",
      "sla_value": "number",
      "sla_unit": "string",
      "sla_warning_value": "number",
      "sla_warning_unit": "string",
      "current_stage_entered_at": "datetime",
      "sla_status": "string (on_time|at_risk|breached)",
      "sla_breached_at": "datetime",
      "current_executive_level_name": "string",
      "status_color": "string (hex)",
      "workflowPermissions": "object",
      "slaInfo": "object"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "pages": "number"
  }
}
```

---

### GET `/:caseId`
Get single case with full details.

**Auth:** Required | **Permission:** Case access

**Response (200):**
```json
{
  "case": {
    "id": "number",
    "case_number": "string",
    "applicant_id": "number",
    "case_type_id": "number",
    "status": "string",
    "roles": "number",
    "assigned_counselor_id": "number",
    "jamiat_id": "number",
    "jamaat_id": "number",
    "created_by": "number",
    "created_at": "datetime",
    "updated_at": "datetime",
    "dcm_full_name": "string",
    "counselor_full_name": "string",
    "counselor_email": "string",
    "counselor_phone": "string",
    "counselor_photo": "string",
    "created_by_full_name": "string",
    "case_type_name": "string",
    "case_type_description": "string",
    "current_workflow_stage_name": "string",
    "status_color": "string (hex)",
    "sla_value": "number",
    "sla_unit": "string",
    "mauze": "string",
    "description": "string",
    "notes": "string",
    "...all applicant fields": "..."
  },
  "statusHistory": [
    {
      "id": "number",
      "case_id": "number",
      "from_status": "string",
      "to_status": "string",
      "changed_by": "number",
      "full_name": "string",
      "created_at": "datetime"
    }
  ],
  "comments": [
    {
      "id": "number",
      "case_id": "number",
      "user_id": "number",
      "comment": "string",
      "comment_type": "string",
      "full_name": "string",
      "created_at": "datetime"
    }
  ],
  "attachments": [
    {
      "id": "number",
      "case_id": "number",
      "file_path": "string",
      "file_type": "string",
      "uploaded_by": "number",
      "uploaded_by_full_name": "string",
      "created_at": "datetime"
    }
  ],
  "workflowPermissions": "object",
  "slaInfo": "object"
}
```

---

### POST `/`
Create new case.

**Auth:** Required | **Permission:** `cases:create`

**Request Body:**
```json
{
  "applicant_id": "number (optional if applicant_data provided)",
  "case_type_id": "number (required)",
  "status_id": "number (optional)",
  "roles": "number (optional, DCM user ID)",
  "assigned_counselor_id": "number (optional)",
  "jamiat_id": "number|string (optional)",
  "jamaat_id": "number|string (optional)",
  "assigned_role": "string (optional)",
  "description": "string (optional)",
  "notes": "string (optional)",
  "workflow_stage_id": "number (optional)",
  "applicant_data": {
    "its_number": "string (required)",
    "first_name": "string (required)",
    "last_name": "string (required)",
    "age": "number (optional)",
    "gender": "string (optional)",
    "phone": "string (optional)",
    "email": "string (optional)",
    "photo": "string (optional)",
    "address": "string (optional)",
    "jamiat_name": "string (optional)",
    "jamaat_name": "string (optional)",
    "jamiat_id": "number|string (optional)",
    "jamaat_id": "number|string (optional)"
  }
}
```

**Response (201):**
```json
{
  "message": "Case created successfully",
  "caseId": "number",
  "caseNumber": "string"
}
```

---

### PUT `/:caseId`
Update case.

**Auth:** Required | **Permission:** Case access

**Request Body:**
```json
{
  "assigned_roles": "number (optional, DCM user ID)",
  "assigned_counselor_id": "number (optional)",
  "estimated_end_date": "string (optional, ISO date)",
  "status": "string (optional)",
  "comments": "string (optional)"
}
```

**Response (200):**
```json
{
  "message": "Case updated successfully"
}
```

---

### DELETE `/:caseId`
Delete case.

**Auth:** Required | **Permission:** `cases:delete`

**Response (200):**
```json
{
  "message": "Case deleted successfully"
}
```

---

### GET `/its/:itsNumber/active`
Check if ITS number has active case.

**Auth:** Required

**Response (200):**
```json
{
  "hasActiveCase": "boolean",
  "activeCases": [
    { "id": "number", "case_number": "string", "status": "string" }
  ]
}
```

---

### GET `/available-counselors`
List available counselors.

**Auth:** Required

**Query Params:** `caseId`, `jamiat_id`, `jamaat_id` (all optional)

**Response (200):**
```json
{
  "counselors": [
    {
      "id": "number",
      "full_name": "string",
      "username": "string",
      "email": "string",
      "its_number": "string",
      "role": "string",
      "jamiat_ids": "string (comma-separated)",
      "jamaat_ids": "string (comma-separated)"
    }
  ]
}
```

---

### PUT `/:caseId/welfare-approve`
Welfare department approval.

**Auth:** Required | **Role:** welfare_reviewer, welfare, admin, super_admin

**Request Body:**
```json
{
  "comments": "string (optional)"
}
```

**Response (200):**
```json
{
  "message": "Case approved successfully by welfare department and forwarded to ZI Review",
  "caseId": "number",
  "caseNumber": "string"
}
```

---

### PUT `/:caseId/welfare-reject`
Welfare department rejection.

**Auth:** Required | **Role:** welfare_reviewer, welfare, admin, super_admin

**Request Body:**
```json
{
  "comments": "string (required)"
}
```

**Response (200):**
```json
{
  "message": "Case sent for rework by welfare department",
  "caseId": "number",
  "caseNumber": "string"
}
```

---

### PUT `/:caseId/welfare-forward-rework`
Forward rework to DCM.

**Auth:** Required | **Role:** welfare_reviewer, welfare, admin, super_admin

**Request Body:**
```json
{
  "comments": "string (required)"
}
```

**Response (200):**
```json
{
  "message": "Case rework forwarded to DCM successfully",
  "caseId": "number",
  "caseNumber": "string"
}
```

---

### PUT `/:caseId/resubmit-welfare`
Resubmit case to welfare after rework.

**Auth:** Required | **Role:** dcm, Deputy Counseling Manager, ZI, admin, super_admin

**Request Body:**
```json
{
  "comments": "string (optional)"
}
```

**Response (200):**
```json
{
  "message": "Case resubmitted successfully to welfare department",
  "caseId": "number",
  "caseNumber": "string"
}
```

---

### PUT `/:caseId/zi-approve`
ZI (Zonal Incharge) approval.

**Auth:** Required | **Role:** ZI, admin, super_admin

**Request Body:**
```json
{
  "comments": "string (optional)"
}
```

**Response (200):**
```json
{
  "message": "Case approved successfully by ZI and forwarded to [Next Stage]",
  "caseId": "number",
  "caseNumber": "string"
}
```

---

### PUT `/:caseId/zi-reject`
ZI rejection.

**Auth:** Required | **Role:** ZI, admin, super_admin

**Request Body:**
```json
{
  "comments": "string (required)"
}
```

**Response (200):**
```json
{
  "message": "Case rejected by ZI and sent back to welfare department",
  "caseId": "number",
  "caseNumber": "string"
}
```

---

### PUT `/:caseId/executive-approve`
Executive approval (multi-level).

**Auth:** Required | **Role:** Executive Management, admin, super_admin

**Request Body:**
```json
{
  "comments": "string (optional)"
}
```

**Response (200):**
```json
{
  "message": "Case approved by [Executive Level Name] and ...",
  "caseId": "number",
  "caseNumber": "string",
  "nextLevel": "number|null"
}
```

---

### PUT `/:caseId/executive-rework`
Executive rework.

**Auth:** Required | **Role:** Executive Management, admin, super_admin

**Request Body:**
```json
{
  "comments": "string (required)"
}
```

**Response (200):**
```json
{
  "message": "Case sent for rework to welfare department by Executive Management",
  "caseId": "number",
  "caseNumber": "string"
}
```

---

### PUT `/:caseId/workflow-action`
Generic workflow action (approve/reject).

**Auth:** Required

**Request Body:**
```json
{
  "action": "string (required, 'approve'|'reject')",
  "comments": "string (optional, required for rejection)"
}
```

**Response (200):**
```json
{
  "message": "string",
  "caseId": "number",
  "caseNumber": "string",
  "newStatus": "string",
  "newStageId": "number"
}
```

---

### GET `/:caseId/comments`
Get case comments.

**Auth:** Required

**Response (200):**
```json
{
  "comments": [
    {
      "id": "number",
      "caseId": "number",
      "userId": "number",
      "userName": "string",
      "userRole": "string",
      "roleName": "string",
      "comment": "string",
      "commentType": "string",
      "executiveLevel": "number",
      "isVisibleToDcm": "boolean",
      "createdAt": "datetime"
    }
  ]
}
```

---

### POST `/:caseId/comments`
Add case comment.

**Auth:** Required

**Request Body:**
```json
{
  "comment": "string (required)",
  "comment_type": "string (optional, default: 'general')"
}
```

**Response (201):**
```json
{
  "message": "Comment added successfully",
  "comment": {
    "id": "number",
    "case_id": "number",
    "user_id": "number",
    "comment": "string",
    "comment_type": "string",
    "full_name": "string",
    "role": "string",
    "created_at": "datetime"
  }
}
```

---

### GET `/:caseId/workflow-comments/:workflowStep`
Get workflow comments for a specific step.

**Auth:** Required

**Response (200):**
```json
{
  "comments": [
    {
      "id": "number",
      "case_id": "number",
      "user_id": "number",
      "comment": "string",
      "comment_type": "string",
      "workflow_step": "string",
      "full_name": "string",
      "email": "string",
      "created_at": "datetime"
    }
  ]
}
```

---

### POST `/:caseId/workflow-comments`
Add workflow comment.

**Auth:** Required

**Request Body:**
```json
{
  "comment": "string (required)",
  "comment_type": "string (optional)",
  "workflow_step": "string (required)"
}
```

**Response (201):**
```json
{
  "message": "Workflow comment added successfully",
  "comment": {
    "id": "number",
    "case_id": "number",
    "user_id": "number",
    "comment": "string",
    "comment_type": "string",
    "workflow_step": "string",
    "full_name": "string",
    "email": "string",
    "created_at": "datetime"
  }
}
```

---

### GET `/:caseId/payment-schedule`
Get payment schedule for a case.

**Auth:** Required | **Permission:** Case access

**Response (200):**
```json
{
  "schedules": [
    {
      "id": "number",
      "case_id": "number",
      "payment_type": "string (qardan_hasana|grant)",
      "year_number": "number",
      "disbursement_year": "number",
      "disbursement_month": "number",
      "disbursement_amount": "number",
      "repayment_months": "number",
      "repayment_start_year": "number",
      "repayment_start_month": "number",
      "is_disbursed": "boolean",
      "disbursed_date": "datetime",
      "created_by": "number",
      "created_by_name": "string",
      "updated_by": "number",
      "updated_by_name": "string",
      "disbursed_by": "number",
      "disbursed_by_name": "string",
      "created_at": "datetime",
      "updated_at": "datetime",
      "repayments": [
        {
          "repayment_year": "number",
          "repayment_month": "number",
          "repayment_amount": "number"
        }
      ]
    }
  ]
}
```

---

### POST `/:caseId/payment-schedule`
Save payment schedule.

**Auth:** Required | **Permission:** Case access

**Request Body:**
```json
{
  "schedules": [
    {
      "payment_type": "string (required, qardan_hasana|grant)",
      "year_number": "number (required)",
      "disbursement_year": "number (required)",
      "disbursement_month": "number (required)",
      "disbursement_amount": "number (required)",
      "repayment_months": "number (optional)",
      "repayment_start_year": "number (optional)",
      "repayment_start_month": "number (optional)"
    }
  ]
}
```

**Response (200):**
```json
{
  "message": "Payment schedule saved successfully"
}
```

---

### POST `/:caseId/payment-schedule/:scheduleId/confirm-disbursement`
Confirm payment disbursement.

**Auth:** Required | **Permission:** Case access

**Request Body:**
```json
{
  "disbursed_date": "string (required, ISO date)",
  "repayment_months": "number (optional)"
}
```

**Response (200):**
```json
{
  "message": "Disbursement confirmed successfully"
}
```

---

### POST `/:caseId/close`
Close a case with documents.

**Auth:** Required | **Permission:** `cases:close_case`

**Request:** Multipart form data
- `reason` (string, required)
- `documents` (file[], required, 1-10 files, max 10MB each)
- Allowed types: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG

**Response (200):**
```json
{
  "message": "Case closed successfully",
  "case_number": "string",
  "status": "closed"
}
```

---

### GET `/:caseId/closure`
Get case closure details.

**Auth:** Required

**Response (200):**
```json
{
  "closure": {
    "id": "number",
    "case_id": "number",
    "reason": "string",
    "closed_by": "number",
    "closed_by_name": "string",
    "created_at": "datetime",
    "documents": [
      {
        "id": "number",
        "file_name": "string",
        "file_type": "string",
        "file_size": "number",
        "created_at": "datetime"
      }
    ]
  }
}
```

---

### GET `/:caseId/closure/documents/:documentId`
Download closure document.

**Auth:** Required

**Response:** File binary download

---

### GET `/status-diagnostics`
Status diagnostics (admin only).

**Auth:** Required | **Role:** admin, super_admin

**Response (200):**
```json
{
  "statusesInCases": ["string"],
  "workflowStages": [
    {
      "id": "number",
      "stage_name": "string",
      "stage_key": "string",
      "sort_order": "number",
      "associated_statuses": ["string"],
      "raw_associated_statuses": "string (JSON)"
    }
  ],
  "inconsistentCasesPreview": [
    {
      "id": "number",
      "case_number": "string",
      "status": "string",
      "stage_id": "number",
      "stage_name": "string"
    }
  ],
  "inconsistentCount": "number"
}
```

---

## 4. Case Identifications (`/api/case-identifications`)

### GET `/`
List case identifications with filters and pagination.

**Auth:** Required | **Permission:** `case_identification:read`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Records per page (max 100) |
| `search` | string | - | Search by ITS or full name |
| `status` | string | - | Filter: pending, eligible, ineligible |
| `eligible_in` | string | - | Filter by case type ID |
| `jamiat` | string | - | Filter by jamiat name |
| `jamaat` | string | - | Filter by jamaat name |

**Response (200):**
```json
{
  "records": [
    {
      "id": "number",
      "its_number": "string",
      "full_name": "string",
      "age": "number",
      "gender": "string",
      "phone": "string",
      "email": "string",
      "photo": "string",
      "address": "string",
      "jamiat": "string",
      "jamaat": "string",
      "eligible_in": "number",
      "total_family_members": "number",
      "earning_family_members": "number",
      "individual_income": "number",
      "family_income": "number",
      "remarks": "string",
      "status": "string",
      "created_by": "number",
      "created_at": "datetime",
      "reviewed_by": "number",
      "reviewed_at": "datetime",
      "review_remarks": "string",
      "case_id": "number",
      "case_type_name": "string",
      "created_by_name": "string",
      "created_by_full_name": "string",
      "reviewed_by_name": "string",
      "reviewed_by_full_name": "string"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number"
  }
}
```

---

### GET `/check-its/:itsNumber`
Check if ITS number is already registered.

**Auth:** Required

**Response (200):**
```json
{
  "exists": "boolean",
  "message": "string (if exists)",
  "record": {
    "id": "number",
    "status": "string",
    "full_name": "string"
  }
}
```

---

### GET `/:id`
Get single case identification.

**Auth:** Required | **Permission:** `case_identification:read`

**Response (200):** Same fields as list item above (single object, not wrapped).

---

### POST `/`
Create new case identification.

**Auth:** Required | **Permission:** `case_identification:create`

**Request Body:**
```json
{
  "its_number": "string (required)",
  "full_name": "string (optional)",
  "age": "number (optional)",
  "gender": "string (optional)",
  "phone": "string (optional)",
  "email": "string (optional)",
  "photo": "string (optional)",
  "address": "string (optional)",
  "jamiat": "string (optional)",
  "jamaat": "string (optional)",
  "eligible_in": "number (required, case type ID)",
  "total_family_members": "number (required, 0-25)",
  "earning_family_members": "number (required, 0-20)",
  "individual_income": "number (required, 0-9999999)",
  "family_income": "number (required, 0-9999999)",
  "remarks": "string (optional)"
}
```

**Response (201):**
```json
{
  "message": "Case identification created successfully",
  "id": "number"
}
```

---

### PUT `/:id/review`
Mark case identification as eligible or ineligible.

**Auth:** Required | **Permission:** `case_identification:approve`

**Request Body:**
```json
{
  "status": "string (required, 'eligible'|'ineligible')",
  "review_remarks": "string (optional)"
}
```

**Response (200):**
```json
{
  "message": "Case identification marked as eligible. Case created successfully.",
  "status": "string",
  "case_id": "number (if eligible)",
  "case_number": "string (if eligible)"
}
```

---

### PUT `/:id/edit`
Edit assessment fields on pending/ineligible cases.

**Auth:** Required | **Permission:** `case_identification:edit`

**Request Body:**
```json
{
  "individual_income": "number (optional, 0-9999999)",
  "family_income": "number (optional, 0-9999999)",
  "eligible_in": "number (optional, case type ID)",
  "total_family_members": "number (optional, 0-25)",
  "earning_family_members": "number (optional, 0-20)",
  "remarks": "string (optional)"
}
```

**Response (200):**
```json
{
  "message": "Case identification updated successfully"
}
```

---

### PUT `/:id/revert-to-pending`
Revert ineligible case back to pending.

**Auth:** Required | **Permission:** `case_identification:edit`

**Response (200):**
```json
{
  "message": "Case reverted to pending status",
  "status": "pending"
}
```

---

## 5. Applicants (`/api/applicants`)

### GET `/`
List applicants with pagination and filters.

**Auth:** Required | **Permission:** `applicants:read`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Results per page |
| `search` | string | - | Search by full_name, its_number, phone |
| `jamiat_id` | number | - | Filter by jamiat |
| `jamaat_id` | number | - | Filter by jamaat |

**Response (200):**
```json
{
  "applicants": [
    {
      "id": "number",
      "its_number": "string",
      "full_name": "string",
      "age": "number",
      "gender": "string (male|female|other)",
      "phone": "string",
      "email": "string",
      "photo": "string",
      "address": "string",
      "jamiat_name": "string",
      "jamaat_name": "string",
      "jamiat_id": "number",
      "jamaat_id": "number",
      "created_at": "datetime",
      "updated_at": "datetime"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "pages": "number"
  }
}
```

---

### GET `/:applicantId`
Get single applicant.

**Auth:** Required | **Permission:** `applicants:read`

**Response (200):**
```json
{
  "applicant": { "...same fields as list item..." }
}
```

---

### GET `/lookup/:itsNumber`
Lookup ITS number (from DB first, then external API).

**Auth:** Required

**Response (200):**
```json
{
  "success": true,
  "source": "string (database|api)",
  "data": {
    "its_number": "string",
    "name": "string",
    "contact_number": "string",
    "email": "string",
    "photo": "string|null"
  }
}
```

---

### GET `/fetch-from-api/:itsNumber`
Fetch applicant data from external ITS API.

**Auth:** None (public)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "its_number": "string",
    "full_name": "string",
    "age": "number",
    "gender": "string",
    "phone": "string",
    "email": "string",
    "photo": "string",
    "address": "string",
    "jamiat_name": "string",
    "jamaat_name": "string",
    "jamiat_id": "string",
    "jamaat_id": "string",
    "country": "string",
    "city": "string",
    "state": "string",
    "occupation": "string",
    "qualification": "string",
    "idara": "string"
  },
  "raw_data": "object"
}
```

---

### POST `/`
Create new applicant.

**Auth:** Required | **Permission:** `applicants:create`

**Request Body:**
```json
{
  "its_number": "string (required)",
  "first_name": "string (required)",
  "last_name": "string (required)",
  "age": "number (optional)",
  "gender": "string (optional, male|female|other)",
  "phone": "string (optional)",
  "email": "string (optional)",
  "photo": "string (optional)",
  "address": "string (optional)",
  "jamiat_name": "string (optional)",
  "jamaat_name": "string (optional)",
  "jamiat_id": "string (optional)",
  "jamaat_id": "string (optional)",
  "case_data": {
    "case_type_id": "number (optional)",
    "description": "string (optional)",
    "notes": "string (optional)",
    "assigned_counselor_id": "number (optional)",
    "assigned_role": "string (optional)",
    "workflow_stage_id": "number (optional)"
  }
}
```

**Response (201):**
```json
{
  "message": "Applicant created successfully",
  "applicantId": "number",
  "caseId": "number (if case_data provided)",
  "caseNumber": "string (if case_data provided)"
}
```

---

### PUT `/:applicantId`
Update applicant.

**Auth:** Required | **Permission:** `applicants:update`

**Request Body:** Same fields as POST (all optional).

**Response (200):**
```json
{
  "message": "Applicant updated successfully"
}
```

---

### DELETE `/:applicantId`
Delete applicant.

**Auth:** Required | **Permission:** `applicants:delete`

**Response (200):**
```json
{
  "message": "Applicant deleted successfully"
}
```

---

### GET `/meta/unique-values`
Get unique filter values.

**Auth:** Required

**Response (200):**
```json
{
  "mauzes": ["string"],
  "cities": ["string"],
  "states": ["string"]
}
```

---

### GET `/meta/pending-count`
Get pending applicants count.

**Auth:** Required

**Response (200):**
```json
{
  "pendingCount": "number"
}
```

---

### POST `/bulk-import`
Bulk import ITS numbers.

**Auth:** Required | **Permission:** `applicants:create`

**Request Body:**
```json
{
  "its_numbers": ["string"] ,
  "case_type_id": "number (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Bulk import completed",
  "summary": {
    "total": "number",
    "inserted": "number",
    "skipped": "number",
    "errors": [{ "its_number": "string", "error": "string" }]
  }
}
```

---

### POST `/bulk-fetch`
Bulk fetch applicant details from external API.

**Auth:** Required | **Permission:** `applicants:update`

**Response (200):**
```json
{
  "success": true,
  "message": "Fetched details for X applicant(s)",
  "summary": {
    "total": "number",
    "fetched": "number",
    "failed": "number",
    "notFound": "number",
    "skipped": "number",
    "errors": [{ "its_number": "string", "error": "string" }]
  }
}
```

---

### POST `/import-excel`
Import ITS numbers from Excel.

**Auth:** Required | **Permission:** `applicants:create`

**Request:** Multipart form data with `file` (Excel)

**Response (200):**
```json
{
  "success": true,
  "message": "Excel import completed",
  "summary": {
    "total": "number",
    "inserted": "number",
    "skipped": "number",
    "errors": [{ "its_number": "string", "error": "string" }]
  }
}
```

---

### GET `/export-template`
Download Excel template.

**Auth:** Required

**Response:** Excel file (`its_numbers_template.xlsx`)

---

## 6. Counseling Forms (`/api/counseling-forms`)

### GET `/case/:caseId`
Get counseling form for a case.

**Auth:** Required | **Permission:** Case access

**Response (200):**
```json
{
  "form": {
    "id": "number",
    "case_id": "number",
    "personal_details": {
      "its_number": "string",
      "name": "string",
      "age": "string",
      "education": "string",
      "jamiat": "string",
      "jamaat": "string",
      "contact_number": "string",
      "email": "string",
      "residential_address": "string",
      "present_occupation": "string",
      "occupation_address": "string",
      "other_info": "string"
    },
    "applicant_info": {
      "full_name": "string",
      "phone": "string",
      "email": "string"
    },
    "counselor_info": {
      "name": "string",
      "contact": "string",
      "its_number": "string"
    },
    "family_details": {
      "other_details": "string",
      "wellbeing": { "food": "string", "housing": "string", "education": "string", "health": "string", "deeni": "string" },
      "income_expense": {
        "income": { "business_monthly": "string", "business_yearly": "string", "salary_monthly": "string", "...": "..." },
        "expenses": { "food_monthly": "string", "food_yearly": "string", "...": "..." },
        "surplus_monthly": "string",
        "deficit_monthly": "string"
      },
      "assets_liabilities": {
        "assets": { "residential": "string", "shop_godown_land": "string", "...": "..." },
        "liabilities": { "borrowing_qardan": "string", "goods_credit": "string", "others": "string", "total": "string" }
      },
      "family_members": [
        { "id": "number", "name": "string", "age": "number", "relation_id": "number", "education_id": "number", "occupation_id": "number", "annual_income": "number" }
      ]
    },
    "assessment": {
      "background": { "education": "string", "work_experience": "string", "family_business": "string", "skills_knowledge": "string", "counselor_assessment": "string" },
      "proposed_business": { "present_business_condition": "string", "trade_mark": "string", "...": "..." },
      "counselor_assessment": { "demand_supply": "string", "growth_potential": "string", "competition_strategy": "string", "support_needed": "array" }
    },
    "financial_assistance": {
      "assistance_required": "string",
      "self_funding": "string",
      "rahen_available": "string",
      "support_needed": "array",
      "qh_fields": "array",
      "timeline": "array",
      "action_plan": "array",
      "timeline_assistance": { "immediate": "array", "after_1st_yr": "array", "...": "..." },
      "support_mentors": [{ "its_number": "string", "name": "string", "contact_number": "string", "email": "string", "photo": "string|null" }]
    },
    "economic_growth": {
      "id": "number",
      "profit_year1": "number",
      "profit_year2": "number",
      "profit_year3": "number",
      "profit_year4": "number",
      "profit_year5": "number",
      "projections": "array"
    },
    "declaration": {
      "applicant_confirmation": "string",
      "applicant_its": "string",
      "applicant_name": "string",
      "applicant_contact": "string",
      "declaration_date": "string (YYYY-MM-DD)",
      "signature_type": "string",
      "signature_file_path": "string",
      "signature_drawing_data": "string",
      "counselor_confirmation": "string",
      "counselor_its": "string",
      "counselor_name": "string",
      "counselor_signature": "string",
      "tr_committee_its": "string",
      "tr_committee_name": "string",
      "tr_committee_signature": "string",
      "...": "..."
    },
    "attachments": "object|null",
    "is_complete": "boolean",
    "completed_at": "datetime|null",
    "created_at": "datetime",
    "updated_at": "datetime"
  },
  "stage_permissions": "object"
}
```

---

### PUT `/:formId/section/:section`
Update counseling form section.

**Auth:** Required

**URL Params:** `formId` (number), `section` (string: personal_details, family_details, assessment, financial_assistance, economic_growth, declaration, attachments)

**Request Body:** Section-specific fields (see counseling form structure above).

**Response (200):**
```json
{
  "message": "string",
  "section": "string",
  "updated": "boolean"
}
```

---

### PUT `/:formId/complete`
Mark counseling form as complete.

**Auth:** Required

**Response (200):**
```json
{
  "message": "Form marked as complete"
}
```

---

## 7. Cover Letters (`/api/cover-letters`)

### POST `/generate/:caseId`
Generate cover letter PDF.

**Auth:** Required | **Permission:** Case access

**Response (200):**
```json
{
  "message": "Cover letter generated successfully",
  "coverLetterId": "number",
  "fileName": "string",
  "filePath": "string"
}
```

---

### GET `/case/:caseId`
Get cover letters for a case.

**Auth:** Required | **Permission:** Case access

**Response (200):**
```json
{
  "coverLetters": [
    {
      "id": "number",
      "case_id": "number",
      "file_path": "string",
      "generated_by": "number",
      "generated_at": "datetime",
      "generated_by_full_name": "string"
    }
  ]
}
```

---

### GET `/download/:coverLetterId`
Download cover letter PDF.

**Auth:** Required

**Response:** PDF file download

---

## 8. Cover Letter Forms (`/api/cover-letter-forms`)

### GET `/case/:caseId`
Get cover letter form with pre-populated data.

**Auth:** Required | **Permission:** Case access

**Response (200):**
```json
{
  "form": {
    "id": "number",
    "case_id": "number",
    "applicant_name": "string|null",
    "applicant_jamiat": "string|null",
    "applicant_jamaat": "string|null",
    "applicant_age": "number|null",
    "applicant_contact_number": "string|null",
    "applicant_case_id": "string|null",
    "applicant_its": "string|null",
    "applicant_photo": "string|null",
    "counsellor_name": "string|null",
    "counsellor_jamiat": "string|null",
    "counsellor_jamaat": "string|null",
    "counsellor_contact_number": "string|null",
    "counsellor_its": "string|null",
    "counsellor_certified": "boolean",
    "counsellor_photo": "string|null",
    "current_personal_income": "number|null",
    "current_family_income": "number|null",
    "earning_family_members": "number|null",
    "dependents": "number|null",
    "asset_house": "string|null",
    "asset_shop": "string|null",
    "asset_gold": "string|null",
    "asset_machinery": "string|null",
    "asset_stock": "string|null",
    "liability_qardan": "number|null",
    "liability_den": "number|null",
    "liability_others": "number|null",
    "business_name": "string|null",
    "industry_segment": "string|null",
    "present_occupation": "string|null",
    "requested_enayat": "number|null",
    "requested_qardan": "number|null",
    "requested_total": "number|null",
    "recommended_enayat": "number|null",
    "recommended_qardan": "number|null",
    "recommended_total": "number|null",
    "applicant_projected_income_after_1_year": "number|null",
    "applicant_projected_income_after_2_years": "number|null",
    "applicant_projected_income_after_3_years": "number|null",
    "applicant_projected_income_after_4_years": "number|null",
    "applicant_projected_income_after_5_years": "number|null",
    "family_projected_income_after_1_year": "number|null",
    "family_projected_income_after_2_years": "number|null",
    "family_projected_income_after_3_years": "number|null",
    "family_projected_income_after_4_years": "number|null",
    "family_projected_income_after_5_years": "number|null",
    "proposed_upliftment_plan": "string",
    "non_financial_assistance": "string",
    "welfare_department_comments": "string",
    "approved_enayat": "number|null",
    "approved_qardan": "number|null",
    "approved_qh_months": "number|null",
    "welfare_department_its": "string|null",
    "welfare_department_name": "string|null",
    "welfare_department_signature_type": "string|null",
    "welfare_department_date": "string (YYYY-MM-DD)|null",
    "zonal_incharge_its": "string|null",
    "zonal_incharge_name": "string|null",
    "zonal_incharge_signature_type": "string|null",
    "zonal_incharge_date": "string (YYYY-MM-DD)|null",
    "operations_head_its": "string|null",
    "operations_head_name": "string|null",
    "operations_head_signature_type": "string|null",
    "operations_head_date": "string (YYYY-MM-DD)|null",
    "is_complete": "boolean",
    "is_approved": "boolean",
    "submitted_at": "datetime|null",
    "created_at": "datetime",
    "updated_at": "datetime"
  },
  "applicantData": { "name": "string", "age": "number", "contact_number": "string", "its": "string", "case_id": "string", "photo": "string|null", "jamiat": "string", "jamaat": "string" },
  "counselorData": { "name": "string", "contact_number": "string", "its": "string", "photo": "string|null", "jamiat": "string", "jamaat": "string" },
  "familyFinancialData": { "current_personal_income": "number|null", "current_family_income": "number|null", "earning_family_members": "number|null", "dependents": "number|null" },
  "familyAssetsLiabilitiesData": { "asset_house": "string|null", "asset_shop": "string|null", "asset_gold": "string|null", "...": "..." },
  "personalOccupationData": "string|null",
  "financialAssistanceTotals": { "total_enayat": "number|null", "total_qardan": "number|null" },
  "economicGrowthProfit": { "profit_year1": "number|null", "profit_year2": "number|null", "profit_year3": "number|null", "profit_year4": "number|null", "profit_year5": "number|null" }
}
```

---

### POST `/case/:caseId`
Create or update cover letter form.

**Auth:** Required | **Permission:** Case access

**Request Body:** All fields from the form object above (all optional).

**Response (200):**
```json
{
  "message": "Cover letter form created/updated successfully",
  "formId": "number"
}
```

---

### PUT `/:formId/submit`
Submit cover letter form.

**Auth:** Required | **Permission:** `cover_letter_forms:submit`

**Response (200):**
```json
{
  "message": "Cover letter form submitted successfully",
  "caseId": "number"
}
```

---

## 9. Roles (`/api/roles`)

### GET `/`
List all roles with permissions.

**Auth:** Required | **Role:** Admin-level

**Response (200):**
```json
{
  "roles": [
    {
      "id": "number",
      "name": "string",
      "display_name": "string",
      "description": "string",
      "is_active": "number (0|1)",
      "is_system_role": "number (0|1)",
      "created_at": "datetime",
      "updated_at": "datetime",
      "permission_count": "number",
      "user_count": "number",
      "permissions": {
        "resource_name": ["action1", "action2"]
      },
      "permissions_counseling_forms_stages": [
        { "stage_key": "string", "stage_name": "string", "can_read": "number (0|1)", "can_update": "number (0|1)" }
      ]
    }
  ]
}
```

---

### GET `/:id`
Get role with detailed permissions and users.

**Auth:** Required | **Role:** super_admin

**Response (200):**
```json
{
  "role": {
    "id": "number",
    "name": "string",
    "display_name": "string",
    "description": "string",
    "is_active": "number (0|1)",
    "is_system_role": "number (0|1)",
    "permissions": "string (JSON)"
  },
  "permissions": [
    { "id": "number", "role_id": "number", "permission": "string", "resource": "string", "action": "string", "created_at": "datetime" }
  ],
  "users": [
    { "id": "number", "full_name": "string", "email": "string", "username": "string", "assigned_at": "datetime" }
  ]
}
```

---

### POST `/`
Create new role.

**Auth:** Required | **Role:** super_admin

**Request Body:**
```json
{
  "name": "string (required)",
  "display_name": "string (required)",
  "description": "string (optional)",
  "permissions": [
    { "permission": "string", "resource": "string", "action": "string" }
  ],
  "counseling_form_stages": [
    { "stage_key": "string", "stage_name": "string", "can_read": "boolean", "can_update": "boolean" }
  ]
}
```

**Response (201):**
```json
{
  "message": "string",
  "role": { "id": "number", "name": "string", "display_name": "string", "description": "string" }
}
```

---

### PUT `/:id`
Update role.

**Auth:** Required | **Role:** super_admin

**Request Body:** Same as POST (all fields optional).

**Response (200):**
```json
{
  "message": "string"
}
```

---

### DELETE `/:id`
Delete role (soft delete).

**Auth:** Required | **Role:** super_admin

**Response (200):**
```json
{
  "message": "string"
}
```

---

### GET `/permissions/available`
Get all available permissions.

**Auth:** Required | **Role:** super_admin

**Response (200):**
```json
{
  "permissions": [
    {
      "resource": "string",
      "actions": ["string"],
      "stages": [{ "key": "string", "name": "string" }]
    }
  ]
}
```

---

### POST `/:id/assign`
Assign role to user.

**Auth:** Required | **Role:** super_admin

**Request Body:**
```json
{
  "user_id": "number (required)",
  "expires_at": "datetime (optional)"
}
```

**Response (200):**
```json
{
  "message": "string"
}
```

---

### DELETE `/:id/unassign/:userId`
Remove role from user.

**Auth:** Required | **Role:** super_admin

**Response (200):**
```json
{
  "message": "string"
}
```

---

### GET `/stats/overview`
Get role statistics.

**Auth:** Required | **Role:** super_admin

**Response (200):**
```json
{
  "stats": {
    "total_roles": "number",
    "active_roles": "number",
    "inactive_roles": "number",
    "total_permissions": "number",
    "active_assignments": "number"
  }
}
```

---

## 10. Permissions (`/api/permissions`)

### GET `/check`
Check if current user has a specific permission.

**Auth:** Required

**Query Params:** `resource` (string, required), `action` (string, required)

**Response (200):**
```json
{
  "hasPermission": "boolean",
  "userRole": "string",
  "resource": "string",
  "action": "string"
}
```

---

### GET `/counseling-form-access`
Check counseling form access.

**Auth:** Required

**Response (200):**
```json
{
  "hasCounselingFormAccess": "boolean",
  "userRole": "string"
}
```

---

### GET `/counseling-form-roles`
Get roles with counseling form access.

**Auth:** Required

**Response (200):**
```json
{
  "roles": ["string"],
  "count": "number"
}
```

---

### GET `/admin-roles`
Get admin roles.

**Auth:** Required

**Response (200):**
```json
{
  "roles": ["string"],
  "count": "number"
}
```

---

### GET `/summary`
Get permission summary for current user.

**Auth:** Required

**Response (200):**
```json
{
  "userRole": "string",
  "permissions": {
    "counselingFormAccess": "boolean",
    "allCasesAccess": "boolean",
    "userManagementAccess": "boolean",
    "roleManagementAccess": "boolean"
  }
}
```

---

## 11. Dashboard (`/api/dashboard`)

### GET `/overview`
Dashboard data (role-dependent).

**Auth:** Required

**Response (200) - Common:**
```json
{
  "totalStats": {
    "total_cases": "number",
    "draft_cases": "number",
    "assigned_cases": "number",
    "counseling_cases": "number",
    "cover_letter_cases": "number",
    "welfare_review_cases": "number",
    "welfare_approved_cases": "number",
    "welfare_rejected_cases": "number",
    "executive_approved_cases": "number",
    "executive_rejected_cases": "number",
    "finance_cases": "number"
  }
}
```

**Additional fields by role:**
- **Admin:** `userStats` (total/active/inactive users + role counts), `recentCases`
- **DCM/ZI:** `assignedCases` (total_assigned, pending_assignment, in_counseling, etc.), `recentAssignedCases`
- **Counselor:** `counselorCases` (total_assigned, active_counseling), `recentCounselorCases`
- **Welfare:** `reviewCases` (pending_review, approved, rejected), `pendingReviewCases`
- **Executive:** `executiveCases` (pending_approval, approved, rejected), `pendingApprovalCases`
- **Finance:** `financeCases` (pending_disbursement, disbursed), `pendingDisbursementCases`

---

### GET `/recent-activities`
Get recent activities.

**Auth:** Required

**Response (200):**
```json
{
  "activities": [
    {
      "id": "number",
      "case_id": "number",
      "status": "string",
      "case_number": "string",
      "case_type": "string",
      "applicant_full_name": "string",
      "changed_by": "number",
      "changed_by_name": "string",
      "created_at": "datetime"
    }
  ]
}
```

---

### GET `/case-pipeline`
Get case pipeline data.

**Auth:** Required

**Response (200):**
```json
{
  "pipelineData": [
    { "status": "string", "count": "number" }
  ]
}
```

---

## 12. Notifications (`/api/notifications`)

### GET `/`
Get user notifications.

**Auth:** Required

**Query Params:** `page` (number, default 1), `limit` (number, default 20), `is_read` (string, optional)

**Response (200):**
```json
{
  "notifications": [
    {
      "id": "number",
      "user_id": "number",
      "case_id": "number",
      "title": "string",
      "message": "string",
      "is_read": "number (0|1)",
      "created_at": "datetime",
      "updated_at": "datetime",
      "case_number": "string",
      "case_type": "string"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "pages": "number"
  }
}
```

---

### PUT `/:notificationId/read` — Mark as read
### PUT `/mark-all-read` — Mark all as read
### GET `/unread-count` — `{ "unreadCount": "number" }`
### DELETE `/:notificationId` — Delete notification
### POST `/check-sla` — Trigger SLA check (admin/super_admin)

All return `{ "message": "string" }` except unread-count.

---

## 13. Attachments (`/api/attachments`)

### POST `/upload/:caseId`
Upload single file.

**Auth:** Required | **Permission:** Case access

**Request:** Multipart form data with `file` + optional `stage` field

**Response (200):**
```json
{
  "message": "File uploaded successfully",
  "attachmentId": "number",
  "fileName": "string",
  "fileSize": "number (bytes)",
  "fileType": "string (MIME)",
  "filePath": "string"
}
```

---

### POST `/upload-multiple/:caseId`
Upload multiple files (max 10).

**Auth:** Required | **Permission:** Case access

**Request:** Multipart form data with `files` + optional `stage`

**Response (200):**
```json
{
  "message": "X files uploaded successfully",
  "files": [
    { "attachmentId": "number", "fileName": "string", "fileSize": "number", "fileType": "string", "filePath": "string" }
  ]
}
```

---

### GET `/case/:caseId`
Get attachments for a case.

**Auth:** Required | **Permission:** Case access

**Response (200):**
```json
{
  "attachments": [
    {
      "id": "number",
      "case_id": "number",
      "file_name": "string",
      "file_path": "string",
      "file_type": "string",
      "file_size": "number",
      "uploaded_by": "number",
      "stage": "string",
      "created_at": "datetime",
      "updated_at": "datetime",
      "uploaded_by_name": "string"
    }
  ],
  "orphanedCount": "number"
}
```

---

### GET `/download/:attachmentId` — Download file (binary)
### DELETE `/:attachmentId` — `{ "message": "Attachment deleted successfully" }`

---

### GET `/stats/:caseId`
Attachment statistics.

**Auth:** Required | **Permission:** Case access

**Response (200):**
```json
{
  "stats": {
    "total_files": "number",
    "total_size": "number|null",
    "stages_with_files": "number"
  },
  "stageStats": [
    { "stage": "string", "file_count": "number", "total_size": "number|null" }
  ]
}
```

---

## 14. Workflow Stages (`/api/workflow-stages`)

### GET `/`
List all active workflow stages.

**Auth:** Required | **Permission:** `master:read`

**Query Params:** `case_type_id` (number, optional)

**Response (200):**
```json
{
  "stages": [
    {
      "id": "number",
      "stage_name": "string",
      "stage_key": "string",
      "description": "string|null",
      "sort_order": "number",
      "case_type_id": "number|null",
      "associated_statuses": "array",
      "sla_value": "number|null",
      "sla_unit": "string|null",
      "sla_warning_value": "number|null",
      "sla_warning_unit": "string|null",
      "is_active": "boolean",
      "created_at": "datetime",
      "updated_at": "datetime",
      "case_type_name": "string|null",
      "role_count": "number",
      "user_count": "number",
      "roles": [
        {
          "id": "number",
          "name": "string",
          "display_name": "string",
          "can_approve": "boolean",
          "can_reject": "boolean",
          "can_review": "boolean",
          "can_view": "boolean",
          "can_edit": "boolean",
          "can_delete": "boolean",
          "can_create_case": "boolean",
          "can_fill_case": "boolean"
        }
      ],
      "users": [
        {
          "id": "number",
          "full_name": "string",
          "email": "string",
          "role": "string",
          "can_approve": "boolean",
          "can_review": "boolean",
          "can_view": "boolean",
          "can_edit": "boolean",
          "can_delete": "boolean",
          "can_create_case": "boolean",
          "can_fill_case": "boolean"
        }
      ]
    }
  ]
}
```

---

### GET `/by-case-type` — Stages grouped by case type
### GET `/status-mappings` — Status-to-stage mapping
### GET `/:id` — Single stage with roles/users
### POST `/` — Create stage
### PUT `/:id` — Update stage
### DELETE `/:id` — Soft delete stage
### PUT `/:id/restore` — Restore deleted stage
### PUT `/reorder` — Reorder stages (body: `{ "stages": [{ "id": "number" }] }`)
### POST `/:id/roles` — Add role to stage
### DELETE `/:id/roles/:roleId` — Remove role from stage
### PUT `/:id/roles/:roleId` — Update role permissions
### POST `/:id/users` — Add user to stage
### DELETE `/:id/users/:userId` — Remove user from stage
### PUT `/:id/users/:userId` — Update user permissions
### GET `/available/roles` — Available roles for assignment
### GET `/available/users` — Available users for assignment

All create/update role/user bodies include permission flags:
```json
{
  "role_id|user_id": "number (required for POST)",
  "can_approve": "boolean",
  "can_reject": "boolean",
  "can_review": "boolean",
  "can_view": "boolean",
  "can_edit": "boolean",
  "can_delete": "boolean",
  "can_create_case": "boolean",
  "can_fill_case": "boolean"
}
```

---

## 15. Welfare Checklist (`/api/welfare-checklist`)

### GET `/categories` — List categories
### GET `/categories/:id` — Single category
### POST `/categories` — Create: `{ "category_name": "string (required)", "description": "string", "sort_order": "number" }`
### PUT `/categories/:id` — Update category
### DELETE `/categories/:id` — Soft delete category
### PUT `/categories/reorder` — Reorder: `{ "categories": [{ "id": "number", "sort_order": "number" }] }`

**Category Response:**
```json
{
  "categories": [
    {
      "id": "number",
      "category_name": "string",
      "description": "string|null",
      "sort_order": "number",
      "is_active": "boolean",
      "created_at": "datetime",
      "updated_at": "datetime",
      "items_count": "number"
    }
  ]
}
```

---

### GET `/items` — List items (query: `category_id`)
### GET `/items/grouped` — Items grouped by category
### GET `/items/:id` — Single item
### POST `/items` — Create: `{ "category_id": "number", "form_section": "string", "checklist_detail": "string", "sort_order": "number", "is_compulsory": "boolean" }`
### PUT `/items/:id` — Update item
### DELETE `/items/:id` — Soft delete item

**Item Response:**
```json
{
  "id": "number",
  "category_id": "number",
  "form_section": "string",
  "checklist_detail": "string",
  "sort_order": "number",
  "is_active": "boolean",
  "is_compulsory": "boolean",
  "category_name": "string"
}
```

---

### GET `/responses/:caseId`
Get checklist responses for a case.

**Response (200):**
```json
{
  "responses": [
    {
      "id": "number",
      "case_id": "number",
      "checklist_item_id": "number",
      "properly_filled": "string",
      "comments": "string|null",
      "overall_remarks": "string|null",
      "filled_by": "number",
      "form_section": "string",
      "checklist_detail": "string",
      "category_name": "string",
      "filled_by_name": "string"
    }
  ],
  "overall_remarks": "string|null"
}
```

---

### POST `/responses/:caseId`
Submit checklist responses.

**Request Body:**
```json
{
  "responses": [
    {
      "checklist_item_id": "number",
      "properly_filled": "string (YES|NO|NA)",
      "comments": "string (optional)"
    }
  ],
  "overall_remarks": "string (optional)"
}
```

**Response (200):**
```json
{
  "message": "Checklist responses submitted successfully",
  "caseId": "number"
}
```

---

### GET `/status/:caseId`
Checklist completion status.

**Response (200):**
```json
{
  "total": "number",
  "filled": "number",
  "isComplete": "boolean",
  "completionPercentage": "number"
}
```

---

## 16. Fund Utilization (`/api/cases/:caseId/fund-utilization`)

### GET `/` — List quarterly reports
### GET `/:id` — Single report with photos/files
### POST `/` — Create: `{ "quarter": "Q1-Q4", "year": "number", "responses": "object" }`
### PUT `/:id` — Update report
### DELETE `/:id` — Delete report
### POST `/:id/photos` — Upload photo (multipart: `photo`, `photo_type`: shop_site|stock_equipment|applicant_work|other)
### POST `/:id/files` — Upload files (multipart: `files`, `question_id`)
### DELETE `/photos/:photoId` — Delete photo
### DELETE `/files/:fileId` — Delete file

**Report Response:**
```json
{
  "report": {
    "id": "number",
    "case_id": "number",
    "quarter": "string",
    "year": "number",
    "responses": "object",
    "created_by": "number",
    "updated_by": "number",
    "created_at": "datetime",
    "updated_at": "datetime"
  },
  "photos": [
    { "id": "number", "file_path": "string", "file_name": "string", "photo_type": "string", "created_at": "datetime" }
  ],
  "files": [
    { "id": "number", "question_id": "number", "file_path": "string", "file_name": "string", "file_size": "number", "mime_type": "string", "created_at": "datetime" }
  ]
}
```

---

## 17. Fund Utilization Master (`/api/fund-utilization-master`)

### GET `/form-config` — Full form configuration (sections + questions)
### GET/POST/PUT/DELETE `/sections` — Section CRUD
### PATCH `/sections/reorder` — Reorder sections
### GET/POST/PUT/DELETE `/questions` — Question CRUD (query: `section_id`)
### PATCH `/questions/reorder` — Reorder questions

**Question fields:**
```json
{
  "section_id": "number",
  "label": "string",
  "field_type": "string",
  "options_json": "string|null",
  "min_length": "number|null",
  "max_length": "number|null",
  "max_file_size_mb": "number|null",
  "max_files": "number|null",
  "table_config": "string|null",
  "parent_question_id": "number|null",
  "parent_trigger_values": "string|null",
  "placeholder": "string|null",
  "sort_order": "number",
  "is_required": "boolean",
  "is_auto_fill": "boolean",
  "auto_fill_key": "string|null"
}
```

---

## 18. Quarterly Report PDF (`/api/cases/:caseId/quarterly-report`)

### GET `/pdf`
Generate quarterly report PDF.

**Auth:** Required | **Permission:** `fund_utilization:read`

**Query Params:** `reportId` (number, required)

**Response:** PDF file download (`Q{quarter}_{year}_Reassessment_Case-{case_number}.pdf`)

---

## 19. Jamiat (`/api/jamiat`)

### GET `/` — List all
### GET `/:id` — Single jamiat
### POST `/` — Create: `{ "name": "string", "jamiat_id": "string", "is_active": "boolean" }`
### PUT `/:id` — Update
### DELETE `/:id` — Delete (cascades jamaat)
### GET `/template/download` — Excel template
### POST `/import` — Import from Excel (multipart: `file`)
### GET `/export/excel` — Export to Excel

**Response:**
```json
{
  "jamiat": [
    { "id": "number", "jamiat_id": "string", "name": "string", "is_active": "boolean", "created_at": "datetime", "updated_at": "datetime" }
  ]
}
```

---

## 20. Jamaat (`/api/jamaat`)

### GET `/` — List all (query: `jamiat_id` to filter)
### GET `/by-jamiat/:jamiatId` — Jamaat by jamiat
### GET `/:id` — Single jamaat
### POST `/` — Create: `{ "jamiat_id": "number", "jamaat_id": "string", "name": "string", "is_active": "boolean" }`
### PUT `/:id` — Update
### DELETE `/:id` — Delete

**Response:**
```json
{
  "jamaat": [
    { "id": "number", "jamiat_id": "number", "jamaat_id": "string", "name": "string", "is_active": "boolean", "parent_jamiat_id": "string", "jamiat_name": "string" }
  ]
}
```

---

## 21. Case Types (`/api/case-types`)

### GET `/` — List all (query: `include_inactive`)
### GET `/:id` — Single
### POST `/` — Create: `{ "name": "string", "description": "string", "sort_order": "number" }`
### PUT `/:id` — Update
### DELETE `/:id` — Delete

**Response:**
```json
{
  "caseTypes": [
    { "id": "number", "name": "string", "description": "string|null", "sort_order": "number", "is_active": "boolean", "created_at": "datetime", "updated_at": "datetime" }
  ]
}
```

---

## 22. Relations (`/api/relations`)

Standard CRUD. **Response:** `[{ "id": "number", "name": "string", "description": "string|null", "is_active": "boolean" }]`

---

## 23. Education Levels (`/api/education-levels`)

Standard CRUD. **Response:** `[{ "id": "number", "name": "string", "description": "string|null", "is_active": "boolean" }]`

---

## 24. Occupations (`/api/occupations`)

Standard CRUD. **Response:** `[{ "id": "number", "name": "string", "description": "string|null", "is_active": "boolean" }]`

---

## 25. Executive Levels (`/api/executive-levels`)

### GET `/` — List with counts
### GET `/:id` — Single
### POST `/` — Create: `{ "level_number": "number", "level_name": "string", "description": "string", "sort_order": "number" }`
### PUT `/:id` — Update
### DELETE `/:id` — Delete
### PUT `/reorder` — Reorder: `{ "levels": [{ "id": "number", "sort_order": "number" }] }`
### GET `/active/list` — Active levels only

**Response:**
```json
{
  "levels": [
    {
      "id": "number",
      "level_number": "number",
      "level_name": "string",
      "description": "string|null",
      "sort_order": "number",
      "is_active": "boolean",
      "assigned_users_count": "number",
      "active_cases_count": "number"
    }
  ]
}
```

---

## 26. Business Assets (`/api/business-assets`)

### GET `/:caseId` — Get assets for a case
### POST `/:caseId` — Create/update assets
### DELETE `/:caseId` — Delete assets

**Response fields (all numbers, 6 year columns each: last_year, year1-year5):**
- `cash_in_hand`, `raw_materials`, `sale_on_credit`, `machines_equipment`, `vehicles`, `shop_godown`, `trademark_goodwill`, `purchase_on_credit`

---

## Common Error Responses

All endpoints may return:
- **401:** `{ "error": "Access denied. No token provided." }` or `{ "error": "Invalid token" }`
- **403:** `{ "error": "Insufficient permissions" }`
- **500:** `{ "error": "Internal server error" }`

---

**Total Endpoints: 150+**

Generated for FACTS v1.0
