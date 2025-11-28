import axios from 'axios';
import { useState, useEffect } from 'react';

/**
 * Check if current user has a specific permission
 * @param {string} resource - The resource (e.g., 'cases', 'users', 'counseling_forms')
 * @param {string} action - The action (e.g., 'create', 'read', 'update', 'delete')
 * @returns {Promise<boolean>} - True if the user has the permission
 */
export const hasPermission = async (resource, action) => {
  try {
    const response = await axios.get('/api/permissions/check', {
      params: { resource, action }
    });
    return response.data.hasPermission;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
};

/**
 * Check if current user has counseling form access
 * @returns {Promise<boolean>} - True if the user has counseling form access
 */
export const hasCounselingFormAccess = async () => {
  try {
    const response = await axios.get('/api/permissions/counseling-form-access');
    return response.data.hasCounselingFormAccess;
  } catch (error) {
    console.error('Error checking counseling form access:', error);
    return false;
  }
};

/**
 * Get all roles that have counseling form access
 * @returns {Promise<Array>} - Array of role names
 */
export const getCounselingFormRoles = async () => {
  try {
    const response = await axios.get('/api/permissions/counseling-form-roles');
    return response.data.roles;
  } catch (error) {
    console.error('Error getting counseling form roles:', error);
    return [];
  }
};

/**
 * Get all roles that have admin access
 * @returns {Promise<Array>} - Array of role names
 */
export const getAdminRoles = async () => {
  try {
    const response = await axios.get('/api/permissions/admin-roles');
    return response.data.roles;
  } catch (error) {
    console.error('Error getting admin roles:', error);
    return [];
  }
};

/**
 * Get comprehensive permission summary for current user
 * @returns {Promise<Object>} - Permission summary object
 */
export const getPermissionSummary = async () => {
  try {
    const response = await axios.get('/api/permissions/summary');
    return response.data;
  } catch (error) {
    console.error('Error getting permission summary:', error);
    return {
      userRole: null,
      permissions: {
        counselingFormAccess: false,
        allCasesAccess: false,
        userManagementAccess: false,
        roleManagementAccess: false
      }
    };
  }
};

/**
 * React hook for checking permissions
 * @param {string} resource - The resource
 * @param {string} action - The action
 * @returns {Object} - { hasPermission, loading, error }
 */
export const usePermission = (resource, action) => {
  const [hasPermissionState, setHasPermissionState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await hasPermission(resource, action);
        setHasPermissionState(result);
      } catch (err) {
        setError(err);
        setHasPermissionState(false);
      } finally {
        setLoading(false);
      }
    };

    if (resource && action) {
      checkPermission();
    }
  }, [resource, action]);

  return { hasPermission: hasPermissionState, loading, error };
};

/**
 * React hook for checking counseling form access
 * @returns {Object} - { hasAccess, loading, error }
 */
export const useCounselingFormAccess = () => {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await hasCounselingFormAccess();
        setHasAccess(result);
      } catch (err) {
        setError(err);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, []);

  return { hasAccess, loading, error };
};
