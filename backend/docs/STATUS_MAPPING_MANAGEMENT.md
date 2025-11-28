# Status Mapping Management Guide

## Where to Check Status Mappings

### 1. **Via API Endpoint (Recommended)**
```
GET /api/workflow-stages/status-mappings
```
**Response includes:**
- `statusToStage`: Maps each status to workflow stage IDs
- `stageToStatus`: Maps each workflow stage to its associated statuses
- `allStatuses`: List of all active statuses
- `allStages`: List of all active workflow stages with their associated statuses

**Example:**
```javascript
// Using fetch or axios
const response = await fetch('/api/workflow-stages/status-mappings', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();

// View status to stage mapping
console.log(data.statusToStage);
// {
//   "draft": [1, 2],
//   "assigned": [3, 4],
//   "in_counseling": [5, 6]
// }

// View stage details
console.log(data.stageToStatus);
// {
//   1: {
//     stage: { id: 1, stage_name: "Draft Stage", ... },
//     statuses: ["draft"]
//   }
// }
```

### 2. **Via Workflow Stages Endpoint**
```
GET /api/workflow-stages
```
**Returns:** All workflow stages with `associated_statuses` array parsed

Each stage object includes:
```json
{
  "id": 1,
  "stage_name": "Draft Stage",
  "stage_key": "draft",
  "sort_order": 1,
  "associated_statuses": ["draft"],  // Already parsed from JSON
  "roles": [...],
  "users": [...]
}
```

### 3. **Via Command Line Script**
```bash
node backend/scripts/viewStatusMappings.js
```
**Output:**
- Lists all workflow stages with their associated statuses
- Shows status-to-stage mapping in both directions
- Highlights unmapped statuses (use pattern matching)

### 4. **Via Frontend (Future Enhancement)**
You can integrate the `/api/workflow-stages/status-mappings` endpoint into your admin UI to display a visual mapping table.

## What Happens When You Change a Status

### Scenario 1: Renaming a Status

**When you update a status name:**
```javascript
PUT /api/statuses/:id
{
  "name": "new_status_name"  // Changed from "old_status_name"
}
```

**System automatically:**
1. ✅ Updates the status name in the `statuses` table
2. ✅ Finds all workflow stages with the old status name in `associated_statuses`
3. ✅ Replaces the old status name with the new name in those stages
4. ✅ Logs the changes for audit

**Example:**
- Old status: `"in_counseling"`
- New status: `"in_progress"`
- System finds: Counselor stage has `["in_counseling", ...]` in `associated_statuses`
- System updates: Counselor stage now has `["in_progress", ...]`

**Result:** ✅ All existing mappings remain intact, just with updated status names.

### Scenario 2: Changing Status Properties (Without Renaming)

**When you update other properties (description, color, etc.):**
- ✅ Status name stays the same
- ✅ Workflow stage mappings are not affected
- ✅ Everything continues to work normally

## What Happens When You Delete a Status

### Before Deletion

**System checks:**
1. ❌ **Cannot delete if used by cases:**
   - Checks `cases.status_id`
   - Returns error: `"Cannot delete status that is being used by existing cases"`

### During Deletion

**If deletion is allowed, system automatically:**
1. ✅ Gets the status name before deletion
2. ✅ Finds all workflow stages with this status in `associated_statuses`
3. ✅ Removes the status from those stages' `associated_statuses` arrays
4. ✅ Deletes the status from `statuses` table

**Example:**
- Deleting status: `"qa_check"`
- System finds: Quality Assurance stage has `["qa_check", "quality_review"]`
- System updates: Quality Assurance stage now has `["quality_review"]`
- System deletes: Status `"qa_check"` from `statuses` table

**Result:** ✅ Workflow stages are automatically cleaned up, no orphaned references.

## Handling Edge Cases

### Case 1: Status Not in Any Workflow Stage
**If you delete a status that's not in any `associated_statuses`:**
- ✅ Deletion proceeds normally
- ✅ No workflow stages need updating

### Case 2: Status Used Only in Pattern Matching
**If you delete a status that's only matched via pattern matching:**
- ✅ Deletion proceeds (no explicit mapping to clean)
- ✅ System will no longer match this status (as expected)

### Case 3: Multiple Stages Reference Same Status
**If multiple stages have the same status in `associated_statuses`:**
- ✅ System updates ALL stages automatically
- ✅ Each stage's mapping is cleaned up independently

### Case 4: Invalid JSON in associated_statuses
**If a stage has corrupted JSON data:**
- ✅ System skips that stage (doesn't break)
- ✅ Error is logged but doesn't prevent status deletion/update

## Best Practices

### ✅ DO:
1. **Check mappings before deleting a status:**
   ```bash
   node scripts/viewStatusMappings.js
   ```
   Or:
   ```javascript
   GET /api/workflow-stages/status-mappings
   ```

2. **Update mappings when adding new statuses:**
   ```javascript
   PUT /api/workflow-stages/:stageId
   {
     "associated_statuses": ["existing_status", "new_status"]
   }
   ```

3. **Use status names consistently:**
   - Status names are case-sensitive
   - Keep names lowercase with underscores (e.g., `"in_counseling"`)

### ❌ DON'T:
1. **Don't manually edit `associated_statuses` JSON in database:**
   - Use the API endpoints instead
   - Manual edits may corrupt JSON structure

2. **Don't delete statuses used by active cases:**
   - System will prevent this, but check first

3. **Don't rename statuses that are hardcoded in logic:**
   - Some status names may be referenced in code
   - Check codebase before renaming

## Verification Commands

### View Current Mappings
```bash
node backend/scripts/viewStatusMappings.js
```

### Test Status Mapping for Specific Status
```bash
node backend/scripts/testWorkflowStageMapping.js
```

### Verify After Status Change
```bash
# After updating a status, verify mappings:
node backend/scripts/viewStatusMappings.js

# Check if the status name appears in workflow stages:
node backend/scripts/verifyWorkflowStageMigration.js
```

## API Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/workflow-stages/status-mappings` | GET | View all status mappings |
| `/api/workflow-stages` | GET | View workflow stages (includes `associated_statuses`) |
| `/api/workflow-stages/:id` | PUT | Update workflow stage (including `associated_statuses`) |
| `/api/statuses/:id` | PUT | Update status (auto-updates mappings if name changed) |
| `/api/statuses/:id` | DELETE | Delete status (auto-removes from mappings) |

## Troubleshooting

### Issue: Status not mapping to expected stage
**Solution:**
1. Check if status is in `associated_statuses`:
   ```bash
   node scripts/viewStatusMappings.js
   ```
2. If not mapped, add it:
   ```javascript
   PUT /api/workflow-stages/:stageId
   { "associated_statuses": ["your_status"] }
   ```

### Issue: Status deleted but still referenced
**Solution:**
- System should auto-clean, but verify:
  ```bash
  node scripts/viewStatusMappings.js
  ```
- If still referenced, manually update:
  ```javascript
  PUT /api/workflow-stages/:stageId
  { "associated_statuses": ["other_status"] }  // Remove deleted status
  ```

### Issue: Status renamed but mappings not updated
**Solution:**
- Check server logs for update errors
- Manually update if needed:
  ```javascript
  PUT /api/workflow-stages/:stageId
  { "associated_statuses": ["new_status_name"] }
  ```


















