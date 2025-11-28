const notificationService = require('../../../services/notificationService');
const { pool } = require('../../../config/database');
const emailService = require('../../../services/emailService');

// Mock dependencies
jest.mock('../../../config/database', () => ({
  pool: {
    execute: jest.fn()
  }
}));

jest.mock('../../../services/emailService', () => ({
  sendCaseStatusNotification: jest.fn(),
  sendCaseAssignmentNotification: jest.fn(),
  sendFormCompletionNotification: jest.fn()
}));

describe('NotificationService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    test('should create notification successfully', async () => {
      const mockInsertId = 123;
      pool.execute.mockResolvedValue([{ insertId: mockInsertId }]);

      const result = await notificationService.createNotification(
        1, // userId
        10, // caseId
        'Test Title',
        'Test Message',
        'info'
      );

      expect(result).toBe(mockInsertId);
      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        [1, 10, 'Test Title', 'Test Message', 'info']
      );
    });

    test('should throw error on database failure', async () => {
      pool.execute.mockRejectedValue(new Error('Database error'));

      await expect(
        notificationService.createNotification(1, 10, 'Title', 'Message', 'info')
      ).rejects.toThrow('Database error');
    });
  });

  describe('markNotificationAsRead', () => {
    test('should mark notification as read', async () => {
      pool.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await notificationService.markNotificationAsRead(123, 1);

      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notifications'),
        [123, 1]
      );
    });

    test('should throw error on database failure', async () => {
      pool.execute.mockRejectedValue(new Error('Database error'));

      await expect(
        notificationService.markNotificationAsRead(123, 1)
      ).rejects.toThrow('Database error');
    });
  });

  describe('markAllNotificationsAsRead', () => {
    test('should mark all notifications as read for user', async () => {
      pool.execute.mockResolvedValue([{ affectedRows: 5 }]);

      await notificationService.markAllNotificationsAsRead(1);

      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notifications'),
        [1]
      );
    });
  });

  describe('getUnreadNotificationCount', () => {
    test('should return unread notification count', async () => {
      const mockCount = 5;
      pool.execute.mockResolvedValueOnce([[{ count: mockCount }]]);

      const result = await notificationService.getUnreadNotificationCount(1);

      expect(result).toBe(mockCount);
      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [1]
      );
    });

    test('should throw error on database failure', async () => {
      pool.execute.mockRejectedValue(new Error('Database error'));

      await expect(
        notificationService.getUnreadNotificationCount(1)
      ).rejects.toThrow('Database error');
    });
  });

  describe('sendCaseStatusNotification', () => {
    test('should send notifications to relevant users', async () => {
      const mockCase = {
        id: 10,
        case_number: 'BS-0010',
        roles: 1,
        assigned_counselor_id: 2
      };

      const mockUsers = [
        { id: 1, email: 'user1@test.com' },
        { id: 2, email: 'user2@test.com' },
        { id: 3, role: 'admin', email: 'admin@test.com' }
      ];

      pool.execute
        .mockResolvedValueOnce([[mockCase]])
        .mockResolvedValueOnce([mockUsers]);

      pool.execute.mockResolvedValue([{ insertId: 100 }]);

      await notificationService.sendCaseStatusNotification(
        10, // caseId
        'draft', // fromStatus
        'assigned', // toStatus
        5, // changedBy
        'Case assigned' // comments
      );

      // Verify notifications were created
      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.any(Array)
      );

      // Verify emails were sent
      expect(emailService.sendCaseStatusNotification).toHaveBeenCalled();
    });

    test('should handle case not found gracefully', async () => {
      pool.execute.mockResolvedValueOnce([[]]); // Case not found

      await notificationService.sendCaseStatusNotification(
        999,
        'draft',
        'assigned',
        1,
        'Test'
      );

      // Should not throw error, just log
      expect(emailService.sendCaseStatusNotification).not.toHaveBeenCalled();
    });
  });

  describe('sendCaseAssignmentNotification', () => {
    test('should send assignment notifications', async () => {
      const mockCase = {
        id: 10,
        case_number: 'BS-0010',
        applicant_first_name: 'John',
        applicant_last_name: 'Doe'
      };

      const mockUsers = [
        { id: 1, email: 'dcm@test.com' },
        { id: 2, email: 'counselor@test.com' }
      ];

      pool.execute
        .mockResolvedValueOnce([[mockCase]])
        .mockResolvedValueOnce([mockUsers]);

      pool.execute.mockResolvedValue([{ insertId: 200 }]);

      await notificationService.sendCaseAssignmentNotification(
        10, // caseId
        1, // assignedDcmId
        2, // assignedCounselorId
        { id: 5, full_name: 'Admin' } // assignedBy
      );

      expect(emailService.sendCaseAssignmentNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendFormCompletionNotification', () => {
    test('should send form completion notifications to welfare and admin', async () => {
      const mockCase = {
        id: 10,
        case_number: 'BS-0010'
      };

      const mockUsers = [
        { id: 3, role: 'welfare_reviewer', email: 'welfare@test.com' },
        { id: 4, role: 'admin', email: 'admin@test.com' }
      ];

      pool.execute
        .mockResolvedValueOnce([[mockCase]])
        .mockResolvedValueOnce([mockUsers]);

      pool.execute.mockResolvedValue([{ insertId: 300 }]);

      await notificationService.sendFormCompletionNotification(10);

      expect(emailService.sendFormCompletionNotification).toHaveBeenCalledTimes(2);
      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.any(Array)
      );
    });
  });
});

