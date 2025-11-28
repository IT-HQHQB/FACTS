# Flexible Workflow Stage Mapping Guide

## Overview

The workflow stage mapping system now supports customizable workflows. You can add, remove, or reorder stages in the middle of the workflow, and the system will intelligently map case statuses to the correct workflow stages.

## How It Works

The system uses a **4-strategy approach** to find the correct workflow stage for a case status:

### Strategy 1: Associated Statuses (Recommended)
Each workflow stage can have an `associated_statuses` JSON array field that explicitly lists which case statuses should trigger this stage.

**Example:**
```json
{
  "stage_name": "Initial Review",
  "stage_key": "initial_review",
  "associated_statuses": ["draft", "assigned"]
}
```

When a case status changes to `draft` or `assigned`, it will automatically move to the "Initial Review" stage.

### Strategy 2: Pattern Matching (Backward Compatibility)
If `associated_statuses` is not set, the system uses flexible pattern matching on `stage_key` to find matching stages.

**Pattern Rules:**
- `draft` → matches stages with keys containing: `draft`, `draft_stage`
- `assigned` → matches: `assigned`, `case_assignment`, `assignment`
- `in_counseling` → matches: `counselor`, `counseling`
- `submitted_to_welfare` → matches: `welfare`, `welfare_review`, `review`
- `executive_*` → matches: `executive`, `executive_approval`, `approval`
- `finance_disbursement` → matches: `finance`, `finance_disbursement`, `disbursement`

### Strategy 3: Sort Order Progression
If no exact match is found, the system uses `sort_order` to move to the next stage in sequence. This is useful when adding new stages in the middle of the workflow.

**Example:**
- Current stage: `sort_order = 3`
- Status changes to: `new_custom_status`
- System finds: Next stage with `sort_order > 3`

### Strategy 4: Fallback to First Stage
For new cases or when no other strategy works, the system defaults to the first stage (lowest `sort_order`).

## Adding a New Stage in the Middle

### Step 1: Run the Migration
```sql
ALTER TABLE workflow_stages 
ADD COLUMN associated_statuses JSON NULL;
```

### Step 2: Create the New Stage
```javascript
POST /api/workflow-stages
{
  "stage_name": "Quality Assurance",
  "stage_key": "quality_assurance",
  "description": "Quality check before welfare review",
  "sort_order": 4,  // Insert between Counselor (3) and Welfare Review (5)
  "associated_statuses": ["qa_check", "quality_review"],  // Optional: link specific statuses
  "roles": [...],
  "users": [...]
}
```

### Step 3: Update Existing Stages (Optional)
You may want to adjust `sort_order` values to maintain sequence:

```sql
-- Reorder stages if needed
UPDATE workflow_stages SET sort_order = 5 WHERE stage_key = 'welfare_review';
UPDATE workflow_stages SET sort_order = 6 WHERE stage_key = 'executive_approval';
-- etc.
```

### Step 4: Link Statuses (Recommended)
Update the new stage to explicitly link it to specific statuses:

```javascript
PUT /api/workflow-stages/:id
{
  "associated_statuses": ["qa_check", "quality_review", "pre_welfare_review"]
}
```

## Example: Complete Workflow Setup

### Stage 1: Draft
```json
{
  "stage_name": "Draft Stage",
  "stage_key": "draft_stage",
  "sort_order": 1,
  "associated_statuses": ["draft"]
}
```

### Stage 2: Assignment
```json
{
  "stage_name": "Case Assignment",
  "stage_key": "case_assignment",
  "sort_order": 2,
  "associated_statuses": ["assigned"]
}
```

### Stage 3: Counselor
```json
{
  "stage_name": "Counselor",
  "stage_key": "counselor",
  "sort_order": 3,
  "associated_statuses": ["in_counseling", "cover_letter_generated", "welfare_rejected"]
}
```

### Stage 4: Quality Assurance (NEW)
```json
{
  "stage_name": "Quality Assurance",
  "stage_key": "quality_assurance",
  "sort_order": 4,
  "associated_statuses": ["qa_check", "quality_review"]
}
```

### Stage 5: Welfare Review
```json
{
  "stage_name": "Welfare Review",
  "stage_key": "welfare_review",
  "sort_order": 5,
  "associated_statuses": ["submitted_to_welfare", "welfare_processing_rework"]
}
```

### Stage 6: Executive Approval
```json
{
  "stage_name": "Executive Approval",
  "stage_key": "executive_approval",
  "sort_order": 6,
  "associated_statuses": ["welfare_approved", "submitted_to_executive", "submitted_to_executive_1", "submitted_to_executive_2", "submitted_to_executive_3"]
}
```

### Stage 7: Finance Disbursement
```json
{
  "stage_name": "Finance Disbursement",
  "stage_key": "finance_disbursement",
  "sort_order": 7,
  "associated_statuses": ["executive_approved", "finance_disbursement"]
}
```

## Migration Script for Existing Stages

If you have existing stages, you can populate `associated_statuses`:

```sql
-- Draft Stage
UPDATE workflow_stages 
SET associated_statuses = JSON_ARRAY('draft')
WHERE stage_key = 'draft_stage';

-- Case Assignment
UPDATE workflow_stages 
SET associated_statuses = JSON_ARRAY('assigned')
WHERE stage_key = 'case_assignment';

-- Counselor
UPDATE workflow_stages 
SET associated_statuses = JSON_ARRAY('in_counseling', 'cover_letter_generated', 'welfare_rejected')
WHERE stage_key = 'counselor';

-- Welfare Review
UPDATE workflow_stages 
SET associated_statuses = JSON_ARRAY('submitted_to_welfare', 'welfare_processing_rework')
WHERE stage_key = 'welfare_review';

-- Executive Approval
UPDATE workflow_stages 
SET associated_statuses = JSON_ARRAY('welfare_approved', 'submitted_to_executive', 'submitted_to_executive_1', 'submitted_to_executive_2', 'submitted_to_executive_3')
WHERE stage_key = 'executive_approval';

-- Finance Disbursement
UPDATE workflow_stages 
SET associated_statuses = JSON_ARRAY('executive_approved', 'finance_disbursement')
WHERE stage_key = 'finance_disbursement';
```

## Benefits

1. **Flexible**: Add stages anywhere in the workflow
2. **Backward Compatible**: Works with existing stage_key-based mappings
3. **Intelligent**: Uses sort_order for automatic progression
4. **Explicit**: Use associated_statuses for precise control
5. **No Breaking Changes**: Existing workflows continue to work

## API Examples

### Create Stage with Associated Statuses
```javascript
POST /api/workflow-stages
{
  "stage_name": "Quality Assurance",
  "stage_key": "qa",
  "sort_order": 4,
  "associated_statuses": ["qa_check", "quality_review"],
  "roles": [/* role assignments */],
  "users": [/* user assignments */]
}
```

### Update Stage Associated Statuses
```javascript
PUT /api/workflow-stages/123
{
  "associated_statuses": ["qa_check", "quality_review", "pre_welfare"]
}
```

## Notes

- The system prioritizes exact matches (Strategy 1) over pattern matching (Strategy 2)
- If multiple stages match, it selects the one with the lowest `sort_order`
- Case type-specific stages take precedence over general stages
- The workflow history tracks all stage transitions with timestamps


















