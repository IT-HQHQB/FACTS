# Counselor Permissions and Assignment Guide

## Overview

This guide explains how to:
1. Assign counselors to workflow stages
2. Configure granular permissions (view/edit/delete) for counselors
3. Assign specific counselors to individual cases
4. Understand how counselors interact with different workflow stages

## Where Counselors are Assigned

Counselors are assigned in **two places**:

### 1. Workflow Stage Level (General Assignment)
**Location:** Workflow Stages Management Page → Counselor Stage → Users button

**Purpose:** Defines which counselors have access to the Counselor workflow stage in general.

**How it works:**
- Go to **Workflow Stages** page
- Click **"Users"** button on the **Counselor** stage (Stage 3)
- Add counselor users to this stage
- Set permissions: `can_view`, `can_edit`, `can_delete`, etc.

### 2. Case Level (Specific Assignment)
**Location:** Case Details/Assignment → `assigned_counselor_id` field

**Purpose:** Assigns a **specific counselor** to a **specific case** from the pool of available counselors.

**How it works:**
- When creating/updating a case, set `assigned_counselor_id`
- This selects which counselor from the available pool will work on this case
- Only counselors assigned to the Counselor workflow stage can be selected

## Counselor Permissions Setup

### Permission Structure

For each workflow stage, counselors can have:
- `can_view` - Can see/read data in this stage
- `can_edit` - Can add/edit/update data in this stage
- `can_delete` - Can delete data in this stage
- `can_review` - Can review data (read-only with comments)
- `can_approve` - Can approve workflow progression

### Required Setup: Counselor View/Edit Permissions

**For counselors to:**
- **View** stages 1, 2, 6, 7 (Draft, Assignment, Executive, Finance)
- **Edit** stages 3, 4, 5 (Counselor, Welfare Review, Executive Approval)

**Configuration Steps:**

1. **Add Counselor Role to View-Only Stages:**

   **Stage 1 - Draft Stage:**
   ```javascript
   POST /api/workflow-stages/:draftStageId/roles
   {
     "role_id": <counselor_role_id>,
     "can_view": true,
     "can_edit": false,
     "can_delete": false
   }
   ```

   **Stage 2 - Case Assignment:**
   ```javascript
   POST /api/workflow-stages/:assignmentStageId/roles
   {
     "role_id": <counselor_role_id>,
     "can_view": true,
     "can_edit": false,
     "can_delete": false
   }
   ```

   **Stage 6 - Executive Approval:**
   ```javascript
   POST /api/workflow-stages/:executiveStageId/roles
   {
     "role_id": <counselor_role_id>,
     "can_view": true,
     "can_edit": false,
     "can_delete": false
   }
   ```

   **Stage 7 - Finance Disbursement:**
   ```javascript
   POST /api/workflow-stages/:financeStageId/roles
   {
     "role_id": <counselor_role_id>,
     "can_view": true,
     "can_edit": false,
     "can_delete": false
   }
   ```

2. **Add Counselor Role to Edit Stages:**

   **Stage 3 - Counselor:**
   ```javascript
   POST /api/workflow-stages/:counselorStageId/roles
   {
     "role_id": <counselor_role_id>,
     "can_view": true,
     "can_edit": true,
     "can_delete": true
   }
   ```

   **Stage 4 - Welfare Review:**
   ```javascript
   POST /api/workflow-stages/:welfareStageId/roles
   {
     "role_id": <counselor_role_id>,
     "can_view": true,
     "can_edit": true,
     "can_delete": false  // Usually can't delete at welfare stage
   }
   ```

   **Stage 5 - Executive Approval:**
   ```javascript
   POST /api/workflow-stages/:executiveApprovalStageId/roles
   {
     "role_id": <counselor_role_id>,
     "can_view": true,
     "can_edit": true,
     "can_delete": false  // Usually can't delete at executive stage
   }
   ```

## Assigning Specific Counselor to a Case

### When You Have Multiple Counselors

**Scenario:** You have 3 counselors in a particular mauze (area), and you want to assign a specific one to a case.

### Step 1: Ensure Counselors are Added to Counselor Workflow Stage

```javascript
// For each counselor user:
POST /api/workflow-stages/:counselorStageId/users
{
  "user_id": <counselor_user_id>,
  "can_view": true,
  "can_edit": true,
  "can_delete": true
}
```

### Step 2: Get Available Counselors for a Case

```javascript
GET /api/cases/available-counselors?caseId=123&jamiat_id=1&jamaat_id=1
```

**Response:**
```json
{
  "counselors": [
    {
      "id": 10,
      "full_name": "Counselor A",
      "email": "counselorA@example.com",
      "role": "counselor"
    },
    {
      "id": 11,
      "full_name": "Counselor B",
      "email": "counselorB@example.com",
      "role": "counselor"
    },
    {
      "id": 12,
      "full_name": "Counselor C",
      "email": "counselorC@example.com",
      "role": "counselor"
    }
  ]
}
```

### Step 3: Assign Specific Counselor to Case

**When Creating Case:**
```javascript
POST /api/cases
{
  "applicant_id": 123,
  "case_type_id": 1,
  "assigned_counselor_id": 10,  // Specific counselor
  "roles": 5,  // DCM user ID
  ...
}
```

**When Updating Case:**
```javascript
PUT /api/cases/:caseId
{
  "assigned_counselor_id": 10  // Assign specific counselor
}
```

### Step 4: Filtering by Area (Jamiat/Jamaat)

The system automatically filters available counselors based on:
- Case's `jamiat_id` and `jamaat_id`
- Counselor's `jamiat_ids` and `jamaat_ids` (comma-separated)

**Example:**
- Case in Jamiat 5, Jamaat 3
- System shows counselors assigned to Jamiat 5 OR Jamaat 3
- Also shows counselors with no area restrictions

## Checking Counselor Permissions

### Get Permissions for All Stages

```javascript
GET /api/cases/counselor-permissions/:counselorId
```

**Response:**
```json
{
  "counselor": {
    "id": 10,
    "full_name": "Counselor A",
    "email": "counselorA@example.com"
  },
  "stagePermissions": [
    {
      "stage": {
        "id": 1,
        "stage_name": "Draft Stage",
        "stage_key": "draft",
        "sort_order": 1
      },
      "permissions": {
        "can_view": true,
        "can_edit": false,
        "can_delete": false,
        "can_approve": false,
        "can_review": false
      }
    },
    {
      "stage": {
        "id": 3,
        "stage_name": "Counselor",
        "stage_key": "counselor",
        "sort_order": 3
      },
      "permissions": {
        "can_view": true,
        "can_edit": true,
        "can_delete": true,
        "can_approve": false,
        "can_review": false
      }
    }
    // ... other stages
  ]
}
```

### Get Permissions for Current Case Stage

When fetching a case, permissions are included:
```javascript
GET /api/cases/:caseId
```

**Response includes:**
```json
{
  "case": {...},
  "workflowPermissions": {
    "can_view": true,
    "can_edit": true,
    "can_delete": true,
    "can_approve": false,
    "can_review": false
  }
}
```

## Permission Check Flow

When a counselor tries to perform an action on case data:

1. **System checks case's current workflow stage**
2. **Checks counselor's permissions for that stage:**
   - First checks role-based permissions (counselor role)
   - Then checks user-specific permissions (overrides role)
3. **Allows/denies action** based on permissions

### Example:
- Case is in "Counselor" stage (Stage 3)
- Counselor tries to edit counseling form
- System checks: Does counselor have `can_edit = true` for Stage 3?
  - ✅ Yes → Allow edit
  - ❌ No → Deny with 403 error

## Setting Up via Workflow Stages UI

### In the Workflow Stages Page:

1. **For View-Only Stages (1, 2, 6, 7):**
   - Click **"Roles"** button on the stage
   - Add "Counselor" role
   - Set: ✅ `can_view`, ❌ `can_edit`, ❌ `can_delete`

2. **For Edit Stages (3, 4, 5):**
   - Click **"Roles"** button on the stage
   - Add "Counselor" role
   - Set: ✅ `can_view`, ✅ `can_edit`, ✅ `can_delete` (for stage 3), ✅ `can_edit`, ❌ `can_delete` (for stages 4, 5)

3. **For Individual Counselors:**
   - Click **"Users"** button on Counselor stage (Stage 3)
   - Add specific counselor users
   - Set individual permissions (overrides role permissions)

## Important Notes

1. **User-specific permissions override role permissions:**
   - If counselor user has `can_edit=false` but role has `can_edit=true`, user's setting wins

2. **Case Assignment:**
   - Only counselors added to the Counselor workflow stage appear in available counselors list
   - Assignment can be filtered by jamiat/jamaat automatically

3. **Permission Inheritance:**
   - If counselor is assigned to Counselor stage but not to other stages, they use role permissions
   - If role not assigned to a stage, counselor has no access to that stage

4. **Case Access:**
   - Counselors can only see cases where `assigned_counselor_id = their_user_id`
   - This is enforced in `authorizeCaseAccess` middleware

## Quick Setup Script

Run this to set up counselor permissions for all 7 stages:

```javascript
// Stages 1, 2, 6, 7: View only
const viewOnlyStages = [draftStageId, assignmentStageId, executiveStageId, financeStageId];
for (const stageId of viewOnlyStages) {
  await assignCounselorRole(stageId, counselorRoleId, {
    can_view: true,
    can_edit: false,
    can_delete: false
  });
}

// Stages 3, 4, 5: Can edit
const editStages = [counselorStageId, welfareStageId, executiveApprovalStageId];
for (const stageId of editStages) {
  await assignCounselorRole(stageId, counselorRoleId, {
    can_view: true,
    can_edit: true,
    can_delete: stageId === counselorStageId // Only stage 3 can delete
  });
}
```


















