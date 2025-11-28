const { 
  hasPermission, 
  hasAnyPermission, 
  getActiveRoles, 
  isValidRole, 
  getRolePermissions 
} = require('../../../utils/roleUtils');
const { pool } = require('../../../config/database');

// Mock the database pool
jest.mock('../../../config/database', () => ({
  pool: {
    execute: jest.fn()
  }
}));

describe('roleUtils Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hasPermission', () => {
    test('should return true when role has permission', async () => {
      pool.execute.mockResolvedValue([[
        { permission: 'cases.read' }
      ]]);

      const result = await hasPermission('admin', 'cases', 'read');
      expect(result).toBe(true);
      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining('role_permissions'),
        ['admin', 'cases', 'read']
      );
    });

    test('should return false when role does not have permission', async () => {
      pool.execute.mockResolvedValue([[]]);

      const result = await hasPermission('counselor', 'cases', 'delete');
      expect(result).toBe(false);
    });

    test('should return false on database error', async () => {
      pool.execute.mockRejectedValue(new Error('Database error'));

      const result = await hasPermission('admin', 'cases', 'read');
      expect(result).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    test('should return true if role has any of the permissions', async () => {
      // First call returns empty (no permission)
      // Second call returns permission (has permission)
      pool.execute
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ permission: 'cases.read' }]]);

      const permissionChecks = [
        { resource: 'cases', action: 'delete' },
        { resource: 'cases', action: 'read' }
      ];

      const result = await hasAnyPermission('admin', permissionChecks);
      expect(result).toBe(true);
      expect(pool.execute).toHaveBeenCalledTimes(2);
    });

    test('should return false if role has none of the permissions', async () => {
      pool.execute.mockResolvedValue([[]]);

      const permissionChecks = [
        { resource: 'cases', action: 'delete' },
        { resource: 'users', action: 'create' }
      ];

      const result = await hasAnyPermission('counselor', permissionChecks);
      expect(result).toBe(false);
    });

    test('should return false on error', async () => {
      pool.execute.mockRejectedValue(new Error('Database error'));

      const permissionChecks = [
        { resource: 'cases', action: 'read' }
      ];

      const result = await hasAnyPermission('admin', permissionChecks);
      expect(result).toBe(false);
    });
  });

  describe('getActiveRoles', () => {
    test('should return active roles', async () => {
      const mockRoles = [
        { name: 'admin', display_name: 'Administrator', description: 'Full access' },
        { name: 'dcm', display_name: 'DCM', description: 'Case manager' }
      ];

      pool.execute.mockResolvedValue([mockRoles]);

      const result = await getActiveRoles();
      expect(result).toEqual(mockRoles);
      expect(pool.execute).toHaveBeenCalled();
    });

    test('should return empty array on error', async () => {
      pool.execute.mockRejectedValue(new Error('Database error'));

      const result = await getActiveRoles();
      expect(result).toEqual([]);
    });
  });

  describe('isValidRole', () => {
    test('should return true for valid active role', async () => {
      pool.execute.mockResolvedValue([[{ id: 1 }]]);

      const result = await isValidRole('admin');
      expect(result).toBe(true);
      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE name = ?'),
        ['admin']
      );
    });

    test('should return false for inactive role', async () => {
      pool.execute.mockResolvedValue([[]]);

      const result = await isValidRole('inactive_role');
      expect(result).toBe(false);
    });

    test('should return false on error', async () => {
      pool.execute.mockRejectedValue(new Error('Database error'));

      const result = await isValidRole('admin');
      expect(result).toBe(false);
    });
  });

  describe('getRolePermissions', () => {
    test('should return role permissions', async () => {
      const mockPermissions = [
        { permission: 'cases.read', resource: 'cases', action: 'read' },
        { permission: 'cases.create', resource: 'cases', action: 'create' },
        { permission: 'users.read', resource: 'users', action: 'read' }
      ];

      pool.execute.mockResolvedValue([mockPermissions]);

      const result = await getRolePermissions('admin');
      expect(result).toEqual(mockPermissions);
      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining('role_permissions'),
        ['admin']
      );
    });

    test('should return empty array when role has no permissions', async () => {
      pool.execute.mockResolvedValue([[]]);

      const result = await getRolePermissions('new_role');
      expect(result).toEqual([]);
    });

    test('should return empty array on error', async () => {
      pool.execute.mockRejectedValue(new Error('Database error'));

      const result = await getRolePermissions('admin');
      expect(result).toEqual([]);
    });
  });
});

