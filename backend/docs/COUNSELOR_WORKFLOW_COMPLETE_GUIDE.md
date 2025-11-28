# Complete Counselor Workflow Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WORKFLOW STAGES                           │
│  ┌──────┐  ┌──────────┐  ┌─────────┐  ┌─────────┐  ┌────┐ │
│  │  1   │→ │    2     │→ │    3    │→ │    4    │→ │ 5  │ │
│  │Draft │  │Assignment│  │Counselor│  │ Welfare │  │Exec│ │
│  └──────┘  └──────────┘  └─────────┘  └─────────┘  └────┘ │
│                                                             │
│  ┌──────┐  ┌──────┐                                         │
│  │  6   │  │  7   │                                         │
│  │Exec  │  │Finance│                                         │
│  └──────┘  └──────┘                                         │
└─────────────────────────────────────────────────────────────┘
         ↓                    ↓
┌─────────────────┐  ┌──────────────────────┐
│  COUNSELOR      │  │   CASE ASSIGNMENT     │
│  PERMISSIONS     │  │   (Specific)          │
│                 │  │                      │
│  View: 1,2,6,7  │  │  assigned_counselor_id│
│  Edit: 3,4,5    │  │  = specific user ID   │
└─────────────────┘  └──────────────────────┘
```

## Answer to Your Questions

### 1. "Where is counselor assigned?"

**Two levels:**

**A. Workflow Stage Level (General Pool):**
- **Location:** Workflow Stages Page → Counselor Stage (Stage 3) → **"Users"** button
- **Purpose:** Adds counselors to the pool of available counselors
- **How:** Click "Users" → Add counselor users → Set permissions
- **Result:** These counselors become available for case assignment

**B. Case Level (Specific Assignment):**
- **Location:** Case Details → `assigned_counselor_id` field
- **Purpose:** Assigns a specific counselor to a specific case
- **Field:** `cases.assigned_counselor_id`
- **How:** When creating/updating case, set this field to counselor's user ID

### 2. "Counselor can only see details in stages 1,2,6,7 but can add/edit/update/delete data in stages 3,4,5"

✅ **This is now configured!**

**Setup:**
- **Stages 1, 2, 6, 7:** `can_view = true`, `can_edit = false`, `can_delete = false`
- **Stages 3, 4, 5:** `can_view = true`, `can_edit = true`, `can_delete = true` (stage 3 only)

**Already configured via:** `setupCounselorPermissions.js` script ✅

### 3. "I want to assign a particular counselor to a case when multiple counselors are available"

✅ **This works through the assignment system:**

**Step 1:** Add counselors to Counselor workflow stage
```
Workflow Stages → Counselor Stage → Users button → Add counselors
```

**Step 2:** Get available counselors
```javascript
GET /api/cases/available-counselors?caseId=123
// Returns only counselors assigned to Counselor stage
// Filtered by jamiat/jamaat if case has area assigned
```

**Step 3:** Assign specific counselor
```javascript
PUT /api/cases/:caseId
{
  "assigned_counselor_id": 10  // Specific counselor from available list
}
```

**Result:** Only that specific counselor has access to this case.

### 4. "Assigning counselors through user management permissions"

✅ **This is how it works!**

**System Flow:**
1. **User Management:** Create counselor users with role = "counselor"
2. **Workflow Stages:** Add counselor users to Counselor stage (Stage 3)
3. **Permissions:** Set permissions via workflow stage roles/users
4. **Case Assignment:** Assign specific counselor via `assigned_counselor_id`

## Complete Setup Process

### Step 1: Add Counselors to Workflow Stage

**Via UI:**
1. Go to **Workflow Stages** page
2. Find **Counselor** stage (Stage 3)
3. Click **"Users"** button
4. Click **"+ Add User"** or select from list
5. Add counselor user(s)
6. Set permissions: `can_view=true`, `can_edit=true`, `can_delete=true`

**Via API:**
```javascript
POST /api/workflow-stages/:counselorStageId/users
{
  "user_id": <counselor_user_id>,
  "can_view": true,
  "can_edit": true,
  "can_delete": true
}
```

### Step 2: Configure Counselor Role Permissions

**Already done via script** (`setupCounselorPermissions.js`):

- ✅ Stages 1, 2, 6, 7: View only
- ✅ Stages 3, 4, 5: Can edit
- ✅ Stage 3: Can delete

### Step 3: Assign Counselor to Case

**When Creating Case:**
```javascript
POST /api/cases
{
  "applicant_id": 123,
  "case_type_id": 1,
  "assigned_counselor_id": 10,  // Specific counselor
  "roles": 5,  // DCM
  ...
}
```

**When Updating Case:**
```javascript
PUT /api/cases/:caseId
{
  "assigned_counselor_id": 11  // Change counselor
}
```

**Get Available Counselors First:**
```javascript
GET /api/cases/available-counselors?caseId=123&jamiat_id=5&jamaat_id=3
// Returns counselors in that area who are assigned to Counselor stage
```

## Permission Enforcement

### How Permissions Work

When a counselor tries to perform an action:

1. **System checks case's current workflow stage**
2. **Checks counselor's permissions for that stage:**
   - First checks role permissions (counselor role)
   - Then checks user-specific permissions (overrides role)
3. **Allows/denies based on permissions**

### Example Scenarios

**Scenario 1: Counselor viewing Stage 1 (Draft)**
- Case in Draft stage
- Counselor has `can_view=true` for Draft stage
- ✅ Allowed to view case details

**Scenario 2: Counselor editing Stage 3 (Counselor)**
- Case in Counselor stage
- Counselor has `can_edit=true` for Counselor stage
- ✅ Allowed to edit counseling form data

**Scenario 3: Counselor trying to edit Stage 1**
- Case in Draft stage
- Counselor has `can_edit=false` for Draft stage
- ❌ Denied with 403 error

**Scenario 4: Counselor viewing Stage 6 (Executive)**
- Case in Executive Approval stage
- Counselor has `can_view=true`, `can_edit=false` for Executive stage
- ✅ Can view case details
- ❌ Cannot edit case data

## Multiple Counselors in Same Area

**Problem:** You have 3 counselors in a particular mauze (area), need to assign specific one.

**Solution:**

1. **All 3 counselors are in the pool:**
   - All added to Counselor workflow stage (Stage 3)
   - All have counselor role

2. **When assigning case:**
   ```javascript
   // Get available counselors (filtered by area automatically)
   GET /api/cases/available-counselors?caseId=123
   
   // Response shows all 3 counselors in that area
   {
     "counselors": [
       { "id": 10, "full_name": "Counselor A" },
       { "id": 11, "full_name": "Counselor B" },
       { "id": 12, "full_name": "Counselor C" }
     ]
   }
   
   // Assign specific one
   PUT /api/cases/:caseId
   {
     "assigned_counselor_id": 10  // Choose Counselor A
   }
   ```

3. **Result:**
   - Only Counselor A can see and work on this case
   - Counselor B and C cannot access this case
   - Case's `assigned_counselor_id = 10`

## Key Points

✅ **Workflow Stage Assignment (General Pool):**
- Adds counselors to available pool
- Done via Workflow Stages → Counselor Stage → Users button

✅ **Case-Specific Assignment:**
- Assigns specific counselor from pool
- Done via `assigned_counselor_id` field on case

✅ **Permissions are Stage-Based:**
- Permissions checked based on case's current workflow stage
- Different permissions for different stages

✅ **User Management Integration:**
- Counselors are users with role = "counselor"
- Assigned to workflow stages via user management
- Permissions set through workflow stage management

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cases/available-counselors` | GET | Get counselors available for case assignment |
| `/api/cases/counselor-permissions/:counselorId` | GET | View counselor permissions for all stages |
| `/api/cases/:caseId` | GET | Get case (includes workflow permissions) |
| `/api/workflow-stages/:id/users` | POST | Add counselor user to workflow stage |
| `/api/workflow-stages/:id/users/:userId` | PUT | Update counselor permissions for stage |
| `/api/workflow-stages/:id/roles` | POST | Add counselor role to workflow stage |

## Verification

Check if everything is set up correctly:

```bash
# 1. Check counselor permissions
GET /api/cases/counselor-permissions/:counselorId

# 2. Check available counselors
GET /api/cases/available-counselors?caseId=123

# 3. Check case permissions
GET /api/cases/:caseId
# Response includes: workflowPermissions
```


















