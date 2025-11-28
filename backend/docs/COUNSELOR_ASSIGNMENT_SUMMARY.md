# Counselor Assignment and Permissions - Quick Reference

## Summary

### Where Counselors are Assigned

1. **Workflow Stage Level (General Pool)**
   - Location: **Workflow Stages Page → Counselor Stage → Users button**
   - Purpose: Defines which counselors have access to the Counselor workflow stage
   - Required: Counselors must be added here to be available for case assignment

2. **Case Level (Specific Assignment)**
   - Location: **Case Creation/Update → `assigned_counselor_id` field**
   - Purpose: Assigns a specific counselor to a specific case
   - Selection: Only counselors from the workflow stage pool can be assigned

### Counselor Permissions (As Configured)

✅ **View Only (Stages 1, 2, 6, 7):**
- Draft Stage (1)
- Case Assignment (2)
- Executive Approval (6)
- Finance Disbursement (7)

✅ **Can Edit (Stages 3, 4, 5):**
- Counselor (3) - Can also delete
- Welfare Review (4) - Can edit, cannot delete
- Executive Approval (5) - Can edit, cannot delete

## How to Assign a Specific Counselor to a Case

### Option 1: Via API

```javascript
// Get available counselors for a case
GET /api/cases/available-counselors?caseId=123

// Response shows only counselors assigned to Counselor workflow stage
{
  "counselors": [
    { "id": 10, "full_name": "Counselor A", ... },
    { "id": 11, "full_name": "Counselor B", ... },
    { "id": 12, "full_name": "Counselor C", ... }
  ]
}

// Assign specific counselor
PUT /api/cases/:caseId
{
  "assigned_counselor_id": 10  // Specific counselor ID
}
```

### Option 2: Via Workflow Stages UI

1. Go to **Workflow Stages** page
2. Find **Counselor** stage (Stage 3)
3. Click **"Users"** button
4. Add counselor users to this stage
5. Now these counselors appear in available counselors list

### Option 3: When Creating Case

```javascript
POST /api/cases
{
  "applicant_id": 123,
  "case_type_id": 1,
  "assigned_counselor_id": 10,  // Assign specific counselor
  "roles": 5,  // DCM user ID
  ...
}
```

## Automatic Filtering

The system automatically:
- ✅ Filters counselors by jamiat/jamaat if case has area assigned
- ✅ Only shows counselors assigned to Counselor workflow stage
- ✅ Includes currently assigned counselor in available list (can reassign)

## Permission Checking

The system automatically checks permissions when:
- Counselor tries to view case data
- Counselor tries to edit case data
- Counselor tries to delete case data

**Permissions are checked based on:**
1. Case's current workflow stage
2. Counselor's role permissions for that stage
3. Counselor's user-specific permissions (overrides role)

## Quick Setup Commands

```bash
# Setup counselor permissions for all stages
node backend/scripts/setupCounselorPermissions.js

# View current permissions
GET /api/cases/counselor-permissions/:counselorId

# View available counselors
GET /api/cases/available-counselors?caseId=123
```


















