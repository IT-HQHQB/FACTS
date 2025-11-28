const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRoles, authorizePermission } = require('../middleware/auth');

const router = express.Router();

// ============================================
// CHECKLIST CATEGORIES ROUTES
// ============================================

// Get all checklist categories
router.get('/categories', authenticateToken, authorizeRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const [categories] = await pool.execute(`
      SELECT 
        wcc.*,
        COUNT(DISTINCT wci.id) as items_count
      FROM welfare_checklist_categories wcc
      LEFT JOIN welfare_checklist_items wci ON wcc.id = wci.category_id AND wci.is_active = TRUE
      WHERE wcc.is_active = TRUE
      GROUP BY wcc.id
      ORDER BY wcc.sort_order ASC, wcc.id ASC
    `);

    res.json({ categories });
  } catch (error) {
    console.error('Get checklist categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get checklist category by ID
router.get('/categories/:id', authenticateToken, authorizeRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [categories] = await pool.execute(
      'SELECT * FROM welfare_checklist_categories WHERE id = ? AND is_active = TRUE',
      [id]
    );

    if (categories.length === 0) {
      return res.status(404).json({ error: 'Checklist category not found' });
    }

    res.json({ category: categories[0] });
  } catch (error) {
    console.error('Get checklist category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create checklist category
router.post('/categories', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { category_name, description, sort_order } = req.body;
    
    if (!category_name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    // Get next sort order if not provided
    let finalSortOrder = sort_order;
    if (!finalSortOrder && finalSortOrder !== 0) {
      const [maxOrder] = await pool.execute(
        'SELECT MAX(sort_order) as max_order FROM welfare_checklist_categories'
      );
      finalSortOrder = (maxOrder[0].max_order || 0) + 1;
    }
    
    const [result] = await pool.execute(
      'INSERT INTO welfare_checklist_categories (category_name, description, sort_order) VALUES (?, ?, ?)',
      [category_name, description || null, finalSortOrder]
    );
    
    const categoryId = result.insertId;
    
    res.status(201).json({ 
      message: 'Checklist category created successfully',
      category: { id: categoryId, category_name, description, sort_order: finalSortOrder }
    });
  } catch (error) {
    console.error('Create checklist category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update checklist category
router.put('/categories/:id', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name, description, sort_order, is_active } = req.body;
    
    const [existing] = await pool.execute(
      'SELECT * FROM welfare_checklist_categories WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Checklist category not found' });
    }
    
    await pool.execute(
      'UPDATE welfare_checklist_categories SET category_name = ?, description = ?, sort_order = ?, is_active = ? WHERE id = ?',
      [category_name, description || null, sort_order, is_active !== false, id]
    );
    
    res.json({ message: 'Checklist category updated successfully' });
  } catch (error) {
    console.error('Update checklist category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete checklist category (soft delete)
router.delete('/categories/:id', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [existing] = await pool.execute(
      'SELECT * FROM welfare_checklist_categories WHERE id = ? AND is_active = TRUE',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Checklist category not found' });
    }
    
    await pool.execute(
      'UPDATE welfare_checklist_categories SET is_active = FALSE WHERE id = ?',
      [id]
    );
    
    res.json({ message: 'Checklist category deleted successfully' });
  } catch (error) {
    console.error('Delete checklist category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reorder checklist categories
router.put('/categories/reorder', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { categories } = req.body;
    
    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: 'Categories array is required' });
    }
    
    // Get a connection for transaction
    const connection = await pool.getConnection();
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      for (const category of categories) {
        await connection.execute(
          'UPDATE welfare_checklist_categories SET sort_order = ? WHERE id = ?',
          [category.sort_order, category.id]
        );
      }
      
      // Commit transaction
      await connection.commit();
      res.json({ message: 'Checklist categories reordered successfully' });
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      throw error;
    } finally {
      // Release connection back to pool
      connection.release();
    }
  } catch (error) {
    console.error('Reorder checklist categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// CHECKLIST ITEMS ROUTES
// ============================================

// Get all checklist items (optionally filtered by category)
router.get('/items', authenticateToken, authorizeRoles('super_admin', 'admin', 'welfare_reviewer', 'welfare'), async (req, res) => {
  try {
    const { category_id } = req.query;
    
    let query = `
      SELECT 
        wci.*,
        wcc.category_name
      FROM welfare_checklist_items wci
      JOIN welfare_checklist_categories wcc ON wci.category_id = wcc.id
      WHERE wci.is_active = TRUE AND wcc.is_active = TRUE
    `;
    
    const queryParams = [];
    if (category_id) {
      query += ' AND wci.category_id = ?';
      queryParams.push(category_id);
    }
    
    query += ' ORDER BY wcc.sort_order ASC, wci.sort_order ASC, wci.form_section ASC';
    
    const [items] = await pool.execute(query, queryParams);
    
    res.json({ items });
  } catch (error) {
    console.error('Get checklist items error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get checklist items grouped by category (for checklist form)
// Allow access if user has role OR welfare_checklist:view permission
router.get('/items/grouped', authenticateToken, async (req, res) => {
  try {
    // Check if user has required role or permission
    const userRole = req.user.role;
    const allowedRoles = ['super_admin', 'admin', 'welfare_reviewer', 'welfare', 'Executive Management', 'executive'];
    
    if (userRole === 'super_admin' || allowedRoles.includes(userRole)) {
      // User has allowed role, proceed
    } else {
      // Check permission
      const [userRoles] = await pool.execute(`
        SELECT r.id, r.name, r.permissions
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      `, [req.user.id]);

      let hasPermission = false;
      
      for (const role of userRoles) {
        if (role.permissions) {
          const permissions = JSON.parse(role.permissions);
          if (permissions['welfare_checklist'] && 
              (permissions['welfare_checklist'].includes('view') || 
               permissions['welfare_checklist'].includes('read'))) {
            hasPermission = true;
            break;
          }
        }
        
        const [granularPermissions] = await pool.execute(`
          SELECT permission FROM role_permissions 
          WHERE role_id = ? AND resource = 'welfare_checklist' AND action IN ('view', 'read')
        `, [role.id]);
        
        if (granularPermissions.length > 0) {
          hasPermission = true;
          break;
        }
      }

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions. Required: welfare_checklist:view or welfare_checklist:read' });
      }
    }

    const [categories] = await pool.execute(`
      SELECT 
        wcc.*
      FROM welfare_checklist_categories wcc
      WHERE wcc.is_active = TRUE
      ORDER BY wcc.sort_order ASC, wcc.id ASC
    `);
    
    const grouped = [];
    
    for (const category of categories) {
      const [items] = await pool.execute(`
        SELECT 
          wci.*
        FROM welfare_checklist_items wci
        WHERE wci.category_id = ? AND wci.is_active = TRUE
        ORDER BY wci.sort_order ASC, wci.form_section ASC
      `, [category.id]);
      
      grouped.push({
        ...category,
        items
      });
    }
    
    res.json({ grouped });
  } catch (error) {
    console.error('Get grouped checklist items error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get checklist item by ID
router.get('/items/:id', authenticateToken, authorizeRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [items] = await pool.execute(`
      SELECT 
        wci.*,
        wcc.category_name
      FROM welfare_checklist_items wci
      JOIN welfare_checklist_categories wcc ON wci.category_id = wcc.id
      WHERE wci.id = ? AND wci.is_active = TRUE
    `, [id]);

    if (items.length === 0) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    res.json({ item: items[0] });
  } catch (error) {
    console.error('Get checklist item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create checklist item
router.post('/items', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { category_id, form_section, checklist_detail, sort_order } = req.body;
    
    if (!category_id || !form_section || !checklist_detail) {
      return res.status(400).json({ error: 'Category ID, form section, and checklist detail are required' });
    }
    
    // Verify category exists
    const [category] = await pool.execute(
      'SELECT id FROM welfare_checklist_categories WHERE id = ? AND is_active = TRUE',
      [category_id]
    );
    
    if (category.length === 0) {
      return res.status(404).json({ error: 'Checklist category not found' });
    }
    
    // Get next sort order if not provided
    let finalSortOrder = sort_order;
    if (!finalSortOrder && finalSortOrder !== 0) {
      const [maxOrder] = await pool.execute(
        'SELECT MAX(sort_order) as max_order FROM welfare_checklist_items WHERE category_id = ?',
        [category_id]
      );
      finalSortOrder = (maxOrder[0].max_order || 0) + 1;
    }
    
    const { is_compulsory = false } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO welfare_checklist_items (category_id, form_section, checklist_detail, sort_order, is_compulsory) VALUES (?, ?, ?, ?, ?)',
      [category_id, form_section, checklist_detail, finalSortOrder, is_compulsory ? 1 : 0]
    );
    
    const itemId = result.insertId;
    
    res.status(201).json({ 
      message: 'Checklist item created successfully',
      item: { id: itemId, category_id, form_section, checklist_detail, sort_order: finalSortOrder }
    });
  } catch (error) {
    console.error('Create checklist item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update checklist item
router.put('/items/:id', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, form_section, checklist_detail, sort_order, is_active, is_compulsory = false } = req.body;
    
    const [existing] = await pool.execute(
      'SELECT * FROM welfare_checklist_items WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }
    
    await pool.execute(
      'UPDATE welfare_checklist_items SET category_id = ?, form_section = ?, checklist_detail = ?, sort_order = ?, is_active = ?, is_compulsory = ? WHERE id = ?',
      [category_id, form_section, checklist_detail, sort_order, is_active !== false, is_compulsory ? 1 : 0, id]
    );
    
    res.json({ message: 'Checklist item updated successfully' });
  } catch (error) {
    console.error('Update checklist item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete checklist item (soft delete)
router.delete('/items/:id', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [existing] = await pool.execute(
      'SELECT * FROM welfare_checklist_items WHERE id = ? AND is_active = TRUE',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }
    
    await pool.execute(
      'UPDATE welfare_checklist_items SET is_active = FALSE WHERE id = ?',
      [id]
    );
    
    res.json({ message: 'Checklist item deleted successfully' });
  } catch (error) {
    console.error('Delete checklist item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// CHECKLIST RESPONSES ROUTES
// ============================================

// Get checklist responses for a case
// Allow access if user has role OR welfare_checklist:view permission
router.get('/responses/:caseId', authenticateToken, async (req, res) => {
  try {
    // Check if user has required role or permission
    const userRole = req.user.role;
    const allowedRoles = ['super_admin', 'admin', 'welfare_reviewer', 'welfare', 'Executive Management', 'executive'];
    
    if (userRole === 'super_admin' || allowedRoles.includes(userRole)) {
      // User has allowed role, proceed
    } else {
      // Check permission
      const [userRoles] = await pool.execute(`
        SELECT r.id, r.name, r.permissions
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      `, [req.user.id]);

      let hasPermission = false;
      
      for (const role of userRoles) {
        if (role.permissions) {
          const permissions = JSON.parse(role.permissions);
          if (permissions['welfare_checklist'] && 
              (permissions['welfare_checklist'].includes('view') || 
               permissions['welfare_checklist'].includes('read'))) {
            hasPermission = true;
            break;
          }
        }
        
        const [granularPermissions] = await pool.execute(`
          SELECT permission FROM role_permissions 
          WHERE role_id = ? AND resource = 'welfare_checklist' AND action IN ('view', 'read')
        `, [role.id]);
        
        if (granularPermissions.length > 0) {
          hasPermission = true;
          break;
        }
      }

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions. Required: welfare_checklist:view or welfare_checklist:read' });
      }
    }

    const { caseId } = req.params;
    
    // Verify case exists
    const [cases] = await pool.execute(
      'SELECT id FROM cases WHERE id = ?',
      [caseId]
    );
    
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    // Get all responses for this case
    const [responses] = await pool.execute(`
      SELECT 
        wcr.*,
        wci.form_section,
        wci.checklist_detail,
        wcc.category_name,
        u.full_name as filled_by_name
      FROM welfare_checklist_responses wcr
      JOIN welfare_checklist_items wci ON wcr.checklist_item_id = wci.id
      JOIN welfare_checklist_categories wcc ON wci.category_id = wcc.id
      JOIN users u ON wcr.filled_by = u.id
      WHERE wcr.case_id = ?
      ORDER BY wcc.sort_order ASC, wci.sort_order ASC, wci.form_section ASC
    `, [caseId]);
    
    // Get overall remarks from welfare_checklist_responses table (get from first response)
    let overallRemarks = '';
    if (responses.length > 0 && responses[0].overall_remarks) {
      overallRemarks = responses[0].overall_remarks;
    }
    
    res.json({ 
      responses,
      overall_remarks: overallRemarks
    });
  } catch (error) {
    console.error('Get checklist responses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit checklist responses for a case (welfare only)
router.post('/responses/:caseId', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { responses, overall_remarks } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Check if user has welfare role
    const normalizedRole = userRole?.toLowerCase();
    if (normalizedRole !== 'welfare_reviewer' && normalizedRole !== 'welfare' && userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only welfare department can fill checklist' });
    }
    
    // Verify case exists and is in correct status
    const [cases] = await pool.execute(
      'SELECT id, status FROM cases WHERE id = ?',
      [caseId]
    );
    
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    const caseData = cases[0];
    
    if (caseData.status !== 'submitted_to_welfare') {
      return res.status(400).json({ error: 'Case must be in submitted_to_welfare status to fill checklist' });
    }
    
    if (!Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ error: 'Responses array is required' });
    }
    
    // Get a connection for transaction
    const connection = await pool.getConnection();
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      // Delete existing responses for this case
      await connection.execute(
        'DELETE FROM welfare_checklist_responses WHERE case_id = ?',
        [caseId]
      );
      
      // Prepare overall remarks value (store in all response rows)
      const overallRemarksValue = overall_remarks && overall_remarks.trim() ? overall_remarks.trim() : null;
      
      // Insert new responses
      for (const response of responses) {
        const { checklist_item_id, properly_filled, comments } = response;
        
        if (!checklist_item_id || !properly_filled) {
          throw new Error('Checklist item ID and properly filled status are required for each response');
        }
        
        // Verify checklist item exists
        const [item] = await connection.execute(
          'SELECT id FROM welfare_checklist_items WHERE id = ? AND is_active = TRUE',
          [checklist_item_id]
        );
        
        if (item.length === 0) {
          throw new Error(`Checklist item ${checklist_item_id} not found`);
        }
        
        await connection.execute(
          'INSERT INTO welfare_checklist_responses (case_id, checklist_item_id, properly_filled, comments, overall_remarks, filled_by) VALUES (?, ?, ?, ?, ?, ?)',
          [caseId, checklist_item_id, properly_filled.toUpperCase(), comments || null, overallRemarksValue, userId]
        );
      }
      
      // Commit transaction
      await connection.commit();
      
      res.json({ 
        message: 'Checklist responses submitted successfully',
        caseId: caseId
      });
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      throw error;
    } finally {
      // Release connection back to pool
      connection.release();
    }
  } catch (error) {
    console.error('Submit checklist responses error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get checklist completion status for a case
// Allow access if user has role OR welfare_checklist:view permission
router.get('/status/:caseId', authenticateToken, async (req, res) => {
  try {
    // Check if user has required role or permission
    const userRole = req.user.role;
    const allowedRoles = ['super_admin', 'admin', 'welfare_reviewer', 'welfare', 'Executive Management', 'executive'];
    
    if (userRole === 'super_admin' || allowedRoles.includes(userRole)) {
      // User has allowed role, proceed
    } else {
      // Check permission
      const [userRoles] = await pool.execute(`
        SELECT r.id, r.name, r.permissions
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      `, [req.user.id]);

      let hasPermission = false;
      
      for (const role of userRoles) {
        if (role.permissions) {
          const permissions = JSON.parse(role.permissions);
          if (permissions['welfare_checklist'] && 
              (permissions['welfare_checklist'].includes('view') || 
               permissions['welfare_checklist'].includes('read'))) {
            hasPermission = true;
            break;
          }
        }
        
        const [granularPermissions] = await pool.execute(`
          SELECT permission FROM role_permissions 
          WHERE role_id = ? AND resource = 'welfare_checklist' AND action IN ('view', 'read')
        `, [role.id]);
        
        if (granularPermissions.length > 0) {
          hasPermission = true;
          break;
        }
      }

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions. Required: welfare_checklist:view or welfare_checklist:read' });
      }
    }

    const { caseId } = req.params;
    
    // Get total checklist items
    const [totalItems] = await pool.execute(
      'SELECT COUNT(*) as count FROM welfare_checklist_items WHERE is_active = TRUE'
    );
    
    // Get filled responses
    const [filledResponses] = await pool.execute(
      'SELECT COUNT(DISTINCT checklist_item_id) as count FROM welfare_checklist_responses WHERE case_id = ?',
      [caseId]
    );
    
    const total = totalItems[0].count || 0;
    const filled = filledResponses[0].count || 0;
    const isComplete = total > 0 && filled === total;
    
    res.json({
      total,
      filled,
      isComplete,
      completionPercentage: total > 0 ? Math.round((filled / total) * 100) : 0
    });
  } catch (error) {
    console.error('Get checklist status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

