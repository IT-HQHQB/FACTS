# Unit Tests

This directory contains unit tests that test individual functions, utilities, and middleware in isolation.

## Test Structure

- **utils/** - Tests for utility functions with mocked dependencies
- **middleware/** - Tests for authentication and authorization middleware
- **services/** - Tests for service classes with mocked database

## Running Unit Tests

### Run all unit tests
```bash
npm test -- __tests__/unit
```

### Run specific unit test file
```bash
npm test -- roleUtils.test.js
```

### Run with coverage
```bash
npm test -- __tests__/unit --coverage
```

## Test Files

### `utils/roleUtils.test.js`
Tests for role utility functions:
- `hasPermission()` - Check if role has specific permission
- `hasAnyPermission()` - Check if role has any of the permissions
- `getActiveRoles()` - Get all active roles
- `isValidRole()` - Validate if role exists and is active
- `getRolePermissions()` - Get permissions for a role

**Mocking:** Database pool is mocked to avoid actual database calls

### `utils/permissionUtils.test.js`
Tests for permission utility functions:
- `hasPermission()` - Permission checking
- `hasAnyPermission()` - Multiple permission checking
- `hasCounselingFormAccess()` - Counseling form access check
- `canAccessAllCases()` - Case access check
- `canManageUsers()` - User management permission check
- `canManageRoles()` - Role management permission check
- Role querying functions

**Mocking:** Database pool is mocked

### `utils/statusTransitions.test.js`
Tests for status transition logic:
- `getValidStatusTransitions()` - Valid status transitions based on current status and user role
- Tests various status flows (draft → assigned, welfare approval/rejection, etc.)
- Tests role-based permissions for status changes

**Pure Function:** No mocking needed - tests pure logic

### `middleware/auth.test.js`
Tests for authentication middleware:
- `authenticateToken()` - JWT token authentication
- `authorizeRoles()` - Role-based authorization
- `authorizePermission()` - Permission-based authorization
- Tests various scenarios: valid tokens, invalid tokens, missing tokens, unauthorized access

**Mocking:** Database pool and JWT are mocked

### `services/notificationService.test.js`
Tests for notification service:
- `createNotification()` - Create in-app notifications
- `markNotificationAsRead()` - Mark notification as read
- `markAllNotificationsAsRead()` - Mark all user notifications as read
- `getUnreadNotificationCount()` - Get count of unread notifications
- `sendCaseStatusNotification()` - Send status change notifications
- `sendCaseAssignmentNotification()` - Send assignment notifications
- `sendFormCompletionNotification()` - Send form completion notifications

**Mocking:** Database pool and email service are mocked

## Best Practices

1. **Isolation**: Each unit test is isolated and doesn't depend on external services
2. **Mocking**: All database calls and external dependencies are mocked
3. **Pure Functions**: Pure functions (like status transitions) are tested without mocks
4. **Edge Cases**: Tests cover success cases, error cases, and edge cases
5. **Fast Execution**: Unit tests should run quickly without I/O operations

## Adding New Unit Tests

When adding new unit tests:

1. Place test files in appropriate subdirectories (`utils/`, `middleware/`, `services/`)
2. Mock all external dependencies (database, services, etc.)
3. Test both success and failure cases
4. Use descriptive test names
5. Keep tests focused on a single function or behavior


















