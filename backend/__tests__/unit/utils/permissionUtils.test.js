const {
  hasPermission,
  hasAnyPermission,
  hasCounselingFormAccess,
  canAccessAllCases,
  canManageUsers,
  canManageRoles,
  getRolesWithPermission,
  getCounselingFormRoles,
  getAdminRoles
} = require('../../../utils/permissionUtils');
const { pool } = require('../../../config/database');

// Mock the database pool
jest.mock('../../../config/database', () => ({
  pool: {
    execute: jest.fn()
  }
}));

describe('permissionUtils Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hasPermission', () => {
    test('should return true when permission exists', async () => {
      pool.execute.mockResolvedValue([[{ permission: 'cases.read' }]]);

      const result = await hasPermission('admin', 'cases', 'read');
      expect(result).toBe(true);
    });

    test('should return false when permission does not exist', async () => {
      pool.execute.mockResolvedValue([[]]);

      const result = await hasPermission('counselor', 'cases', 'delete');
      expect(result).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    test('should return true if any permission exists', async () => {
      pool.execute
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ permission: 'cases.read' }]]);

      const result = await hasAnyPermission('admin', [
        { resource: 'cases', action: 'delete' },
        { resource: 'cases', action: 'read' }
      ]);
      expect(result).toBe(true);
    });

    test('should return false if no permissions exist', async () => {
      pool.execute.mockResolvedValue([[]]);

      const result = await hasAnyPermission('guest', [
        { resource: 'cases', action: 'read' }
      ]);
      expect(result).toBe(false);
    });
  });

  describe('hasCounselingFormAccess', () => {
    test('should return true when user has counseling form permissions', async () => {
      pool.execute.mockResolvedValue([[{ permission: 'counseling_forms.read' }]]);

      const result = await hasCounselingFormAccess('dcm');
      expect(result).toBe(true);
    });

    test('should return false when user lacks counseling form permissions', async () => {
      pool.execute.mockResolvedValue([[]]);

      const result = await hasCounselingFormAccess('guest');
      expect(result).toBe(false);
    });
  });

  describe('canAccessAllCases', () => {
    test('should return true when role has cases.read permission', async () => {
      pool.execute.mockResolvedValue([[{ permission: 'cases.read' }]]);

      const result = await canAccessAllCases('admin');
      expect(result).toBe(true);
    });

    test('should return false when role lacks cases.read permission', async () => {
      pool.execute.mockResolvedValue([[]]);

      const result = await canAccessAllCases('counselor');
      expect(result).toBe(false);
    });
  });

  describe('canManageUsers', () => {
    test('should return true when user has user management permissions', async () => {
      pool.execute.mockResolvedValue([[{ permission: 'users.create' }]]);

      const result = await canManageUsers('admin');
      expect(result).toBe(true);
    });

    test('should return false when user lacks user management permissions', async () => {
      pool.execute.mockResolvedValue([[]]);

      const result = await canManageUsers('counselor');
      expect(result).toBe(false);
    });
  });

  describe('canManageRoles', () => {
    test('should return true when user has role management permissions', async () => {
      pool.execute.mockResolvedValue([[{ permission: 'roles.create' }]]);

      const result = await canManageRoles('super_admin');
      expect(result).toBe(true);
    });

    test('should return false when user lacks role management permissions', async () => {
      pool.execute.mockResolvedValue([[]]);

      const result = await canManageRoles('admin');
      expect(result).toBe(false);
    });
  });

  describe('getRolesWithPermission', () => {
    test('should return roles with specific permission', async () => {
      const mockRoles = [
        { name: 'admin' },
        { name: 'super_admin' }
      ];

      pool.execute.mockResolvedValue([mockRoles]);

      const result = await getRolesWithPermission('cases', 'read');
      expect(result).toEqual(['admin', 'super_admin']);
    });

    test('should return empty array when no roles have permission', async () => {
      pool.execute.mockResolvedValue([[]]);

      const result = await getRolesWithPermission('cases', 'delete');
      expect(result).toEqual([]);
    });
  });

  describe('getCounselingFormRoles', () => {
    test('should return roles with counseling form access', async () => {
      const mockRoles = [
        { name: 'dcm' },
        { name: 'counselor' }
      ];

      pool.execute.mockResolvedValue([mockRoles]);

      const result = await getCounselingFormRoles();
      expect(result).toEqual(['dcm', 'counselor']);
    });
  });

  describe('getAdminRoles', () => {
    test('should return admin-level roles', async () => {
      const mockRoles = [
        { name: 'admin' },
        { name: 'super_admin' }
      ];

      pool.execute.mockResolvedValue([mockRoles]);

      const result = await getAdminRoles();
      expect(result).toEqual(['admin', 'super_admin']);
    });
  });
});


















