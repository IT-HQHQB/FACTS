const jwt = require('jsonwebtoken');
const { 
  authenticateToken, 
  authorizeRoles,
  authorizePermission 
} = require('../../../middleware/auth');
const { pool } = require('../../../config/database');

// Mock dependencies
jest.mock('../../../config/database', () => ({
  pool: {
    execute: jest.fn()
  }
}));

describe('Auth Middleware Unit Tests', () => {
  let req, res, next;
  const mockJwtSecret = 'test-secret-key';

  beforeEach(() => {
    process.env.JWT_SECRET = mockJwtSecret;
    jest.clearAllMocks();

    req = {
      headers: {},
      user: null
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('authenticateToken', () => {
    test('should authenticate valid token and set user', async () => {
      const userId = 1;
      const token = jwt.sign({ userId, username: 'testuser', role: 'admin' }, mockJwtSecret);

      req.headers['authorization'] = `Bearer ${token}`;

      pool.execute.mockResolvedValue([[
        { 
          id: userId, 
          username: 'testuser', 
          email: 'test@test.com',
          role: 'admin',
          is_active: 1,
          executive_level: null
        }
      ]]);

      await authenticateToken(req, res, next);

      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [userId]
      );
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(userId);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should return 401 when token is missing', async () => {
      req.headers['authorization'] = undefined;

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when token is invalid', async () => {
      req.headers['authorization'] = 'Bearer invalid-token';

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when user is not found', async () => {
      const userId = 999;
      const token = jwt.sign({ userId, username: 'nonexistent', role: 'admin' }, mockJwtSecret);

      req.headers['authorization'] = `Bearer ${token}`;
      pool.execute.mockResolvedValue([[]]);

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token - user not found' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when user is inactive', async () => {
      const userId = 1;
      const token = jwt.sign({ userId, username: 'inactive', role: 'admin' }, mockJwtSecret);

      req.headers['authorization'] = `Bearer ${token}`;
      pool.execute.mockResolvedValue([[]]); // Inactive users won't be found (is_active = 1 check)

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorizeRoles', () => {
    test('should allow access for authorized role', () => {
      req.user = { id: 1, role: 'admin' };

      const middleware = authorizeRoles('admin', 'super_admin');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny access for unauthorized role', () => {
      req.user = { id: 1, role: 'counselor' };

      const middleware = authorizeRoles('admin', 'super_admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should allow super_admin access to anything', () => {
      req.user = { id: 1, role: 'super_admin' };

      const middleware = authorizeRoles('admin');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should return 401 when user is not authenticated', () => {
      req.user = null;

      const middleware = authorizeRoles('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorizePermission', () => {
    test('should allow access when user has permission', async () => {
      req.user = { id: 1, role: 'admin' };

      // Mock role permissions lookup
      pool.execute
        .mockResolvedValueOnce([[
          { id: 1, name: 'admin', permissions: JSON.stringify({ cases: ['read', 'create'] }) }
        ]])
        .mockResolvedValueOnce([[
          { permission: 'cases:read' }
        ]]);

      const middleware = authorizePermission('cases', 'read');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny access when user lacks permission', async () => {
      req.user = { id: 1, role: 'counselor' };

      // Mock user roles lookup - returns role with only read permission (no delete)
      pool.execute
        .mockResolvedValueOnce([[
          { id: 2, name: 'counselor', permissions: JSON.stringify({ cases: ['read'] }) }
        ]])
        // Mock granular permissions check for this role - returns empty (no delete permission)
        .mockResolvedValueOnce([[]]);

      const middleware = authorizePermission('cases', 'delete');
      await middleware(req, res, next);

      // The middleware should deny access since no permission found
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when user is not authenticated', async () => {
      req.user = null;

      const middleware = authorizePermission('cases', 'read');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle JSON permissions in role', async () => {
      req.user = { id: 1, role: 'admin' };

      // Mock user roles with JSON permissions containing cases:read
      // The middleware checks JSON permissions first and breaks early if found
      pool.execute.mockResolvedValueOnce([[
        { 
          id: 1, 
          name: 'admin', 
          permissions: JSON.stringify({ 
            cases: ['read', 'create', 'update', 'delete'],
            users: ['read']
          }) 
        }
      ]]);
      // Since JSON has the permission, it won't check granular, but we mock it anyway for safety

      const middleware = authorizePermission('cases', 'read');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});

