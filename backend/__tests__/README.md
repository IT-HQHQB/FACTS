# Test Documentation

## Overview
This test suite provides comprehensive testing for the complete approval flow in the Baaseteen Case Management System, including:
- Case creation
- Counseling form creation and updates
- Welfare approval/rejection
- Executive approval/rejection
- Comments and history tracking
- Error handling

## Prerequisites
1. **Database Setup**: Ensure your test database is configured and accessible
2. **Environment Variables**: Create a `.env.test` file or set `NODE_ENV=test`
3. **Test Database**: Tests use the actual database, so ensure you have a test database or are comfortable with test data in your development database

## Running Tests

### Run all tests
```bash
cd backend
npm test
```

### Run specific test file
```bash
npm test -- approvalFlow.test.js
```

### Run with coverage
```bash
npm test -- --coverage
```

## Test Structure

### 1. Test Helpers (`__tests__/helpers/testHelpers.js`)
Helper functions for:
- Creating test users with roles and permissions
- Creating test applicants, cases, and related entities
- Generating authentication tokens
- Cleaning up test data

### 2. Approval Flow Tests (`__tests__/approvalFlow.test.js`)
Comprehensive tests covering:
- Case creation flow
- Counseling form sections (personal details, family details, assessment, financial assistance, economic growth, declaration, attachments)
- Form completion
- Welfare approval/rejection
- Executive approval/rejection
- Comments and history
- Error handling and edge cases
- Data validation

## Important Notes

1. **Database Schema**: Some queries in the routes reference columns that may not exist in your database schema:
   - `assigned_dcm_id` in cases table
   - `first_name`/`last_name` vs `full_name` in applicants table
   
   You may need to update the route queries or database schema to match.

2. **Permissions**: Test users are created with roles, but you may need to ensure:
   - Roles exist in the database
   - Role permissions are properly configured
   - Users have necessary permissions for their operations

3. **Executive Levels**: The tests check for existing executive levels and reuse them if found. Ensure at least two active executive levels exist, or the tests will create them.

4. **Cleanup**: Tests clean up after themselves, but in case of failures, you may need to manually clean up test data.

## Known Issues

1. Some database schema mismatches may cause certain tests to fail
2. Permission setup may need adjustment based on your database configuration
3. Tests use the actual database connection, so ensure proper environment configuration

## Troubleshooting

### Permission Errors (403)
- Ensure test users have proper roles assigned
- Verify role permissions in the database
- Check that user_roles table has active assignments

### Database Errors
- Verify database connection settings
- Ensure all required tables exist
- Check for schema mismatches

### Token Errors
- Verify JWT_SECRET is set
- Ensure users exist in database when tokens are generated


















