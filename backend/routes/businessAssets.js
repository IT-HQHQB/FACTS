const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { authenticateToken } = require('../middleware/auth');
const permissionMiddleware = require('../middleware/permissionMiddleware');

// Database connection
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'baaseteen_cms'
};

// Get business assets data for a case
router.get('/:caseId', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        
        const [rows] = await connection.execute(
            'SELECT * FROM business_assets WHERE case_id = ?',
            [caseId]
        );
        
        await connection.end();
        
        if (rows.length === 0) {
            // Return empty structure if no data exists
            const emptyData = {
                case_id: parseInt(caseId),
                cash_in_hand_last_year: 0,
                cash_in_hand_year1: 0,
                cash_in_hand_year2: 0,
                cash_in_hand_year3: 0,
                cash_in_hand_year4: 0,
                cash_in_hand_year5: 0,
                raw_materials_last_year: 0,
                raw_materials_year1: 0,
                raw_materials_year2: 0,
                raw_materials_year3: 0,
                raw_materials_year4: 0,
                raw_materials_year5: 0,
                sale_on_credit_last_year: 0,
                sale_on_credit_year1: 0,
                sale_on_credit_year2: 0,
                sale_on_credit_year3: 0,
                sale_on_credit_year4: 0,
                sale_on_credit_year5: 0,
                machines_equipment_last_year: 0,
                machines_equipment_year1: 0,
                machines_equipment_year2: 0,
                machines_equipment_year3: 0,
                machines_equipment_year4: 0,
                machines_equipment_year5: 0,
                vehicles_last_year: 0,
                vehicles_year1: 0,
                vehicles_year2: 0,
                vehicles_year3: 0,
                vehicles_year4: 0,
                vehicles_year5: 0,
                shop_godown_last_year: 0,
                shop_godown_year1: 0,
                shop_godown_year2: 0,
                shop_godown_year3: 0,
                shop_godown_year4: 0,
                shop_godown_year5: 0,
                trademark_goodwill_last_year: 0,
                trademark_goodwill_year1: 0,
                trademark_goodwill_year2: 0,
                trademark_goodwill_year3: 0,
                trademark_goodwill_year4: 0,
                trademark_goodwill_year5: 0,
                purchase_on_credit_last_year: 0,
                purchase_on_credit_year1: 0,
                purchase_on_credit_year2: 0,
                purchase_on_credit_year3: 0,
                purchase_on_credit_year4: 0,
                purchase_on_credit_year5: 0
            };
            return res.json(emptyData);
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching business assets:', error);
        res.status(500).json({ error: 'Failed to fetch business assets data' });
    }
});

// Create or update business assets data
router.post('/:caseId', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        const data = req.body;
        
        const connection = await mysql.createConnection(dbConfig);
        
        // Check if record exists
        const [existing] = await connection.execute(
            'SELECT id FROM business_assets WHERE case_id = ?',
            [caseId]
        );
        
        if (existing.length > 0) {
            // Update existing record
            const updateFields = [];
            const updateValues = [];
            
            const fields = [
                'cash_in_hand_last_year', 'cash_in_hand_year1', 'cash_in_hand_year2', 'cash_in_hand_year3', 'cash_in_hand_year4', 'cash_in_hand_year5',
                'raw_materials_last_year', 'raw_materials_year1', 'raw_materials_year2', 'raw_materials_year3', 'raw_materials_year4', 'raw_materials_year5',
                'sale_on_credit_last_year', 'sale_on_credit_year1', 'sale_on_credit_year2', 'sale_on_credit_year3', 'sale_on_credit_year4', 'sale_on_credit_year5',
                'machines_equipment_last_year', 'machines_equipment_year1', 'machines_equipment_year2', 'machines_equipment_year3', 'machines_equipment_year4', 'machines_equipment_year5',
                'vehicles_last_year', 'vehicles_year1', 'vehicles_year2', 'vehicles_year3', 'vehicles_year4', 'vehicles_year5',
                'shop_godown_last_year', 'shop_godown_year1', 'shop_godown_year2', 'shop_godown_year3', 'shop_godown_year4', 'shop_godown_year5',
                'trademark_goodwill_last_year', 'trademark_goodwill_year1', 'trademark_goodwill_year2', 'trademark_goodwill_year3', 'trademark_goodwill_year4', 'trademark_goodwill_year5',
                'purchase_on_credit_last_year', 'purchase_on_credit_year1', 'purchase_on_credit_year2', 'purchase_on_credit_year3', 'purchase_on_credit_year4', 'purchase_on_credit_year5'
            ];
            
            fields.forEach(field => {
                if (data[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(data[field] || 0);
                }
            });
            
            updateValues.push(caseId);
            
            await connection.execute(
                `UPDATE business_assets SET ${updateFields.join(', ')} WHERE case_id = ?`,
                updateValues
            );
        } else {
            // Insert new record
            const insertFields = ['case_id'];
            const insertValues = [caseId];
            const placeholders = ['?'];
            
            const fields = [
                'cash_in_hand_last_year', 'cash_in_hand_year1', 'cash_in_hand_year2', 'cash_in_hand_year3', 'cash_in_hand_year4', 'cash_in_hand_year5',
                'raw_materials_last_year', 'raw_materials_year1', 'raw_materials_year2', 'raw_materials_year3', 'raw_materials_year4', 'raw_materials_year5',
                'sale_on_credit_last_year', 'sale_on_credit_year1', 'sale_on_credit_year2', 'sale_on_credit_year3', 'sale_on_credit_year4', 'sale_on_credit_year5',
                'machines_equipment_last_year', 'machines_equipment_year1', 'machines_equipment_year2', 'machines_equipment_year3', 'machines_equipment_year4', 'machines_equipment_year5',
                'vehicles_last_year', 'vehicles_year1', 'vehicles_year2', 'vehicles_year3', 'vehicles_year4', 'vehicles_year5',
                'shop_godown_last_year', 'shop_godown_year1', 'shop_godown_year2', 'shop_godown_year3', 'shop_godown_year4', 'shop_godown_year5',
                'trademark_goodwill_last_year', 'trademark_goodwill_year1', 'trademark_goodwill_year2', 'trademark_goodwill_year3', 'trademark_goodwill_year4', 'trademark_goodwill_year5',
                'purchase_on_credit_last_year', 'purchase_on_credit_year1', 'purchase_on_credit_year2', 'purchase_on_credit_year3', 'purchase_on_credit_year4', 'purchase_on_credit_year5'
            ];
            
            fields.forEach(field => {
                insertFields.push(field);
                insertValues.push(data[field] || 0);
                placeholders.push('?');
            });
            
            await connection.execute(
                `INSERT INTO business_assets (${insertFields.join(', ')}) VALUES (${placeholders.join(', ')})`,
                insertValues
            );
        }
        
        await connection.end();
        
        res.json({ message: 'Business assets data saved successfully' });
    } catch (error) {
        console.error('Error saving business assets:', error);
        res.status(500).json({ error: 'Failed to save business assets data' });
    }
});

// Delete business assets data
router.delete('/:caseId', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        
        await connection.execute(
            'DELETE FROM business_assets WHERE case_id = ?',
            [caseId]
        );
        
        await connection.end();
        
        res.json({ message: 'Business assets data deleted successfully' });
    } catch (error) {
        console.error('Error deleting business assets:', error);
        res.status(500).json({ error: 'Failed to delete business assets data' });
    }
});

module.exports = router;
