import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getCounselingFormRoles, getAdminRoles } from '../utils/permissionUtils';

const ProtectedRoute = ({ children, requireCounselingFormAccess = false, requireAdminAccess = false, requiredPermission = null }) => {
  const { user } = useAuth();
  const [allowedRoles, setAllowedRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        setLoading(true);
        setError(null);

        if (requireCounselingFormAccess) {
          const roles = await getCounselingFormRoles();
          setAllowedRoles(roles);
        } else if (requireAdminAccess) {
          const roles = await getAdminRoles();
          setAllowedRoles(roles);
        } else {
          // No specific permission required
          setAllowedRoles([]);
        }
      } catch (err) {
        console.error('Error checking permissions:', err);
        setError('Failed to check permissions');
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, [requireCounselingFormAccess, requireAdminAccess]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Permission Error</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
          <p className="text-gray-600">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  // If requiredPermission is set, check user has it (or is super admin)
  if (requiredPermission && requiredPermission.resource && requiredPermission.action) {
    const isSuperAdmin = user.role === 'super_admin' || user.role === 'Super Administrator';
    if (isSuperAdmin) {
      return children;
    }
    const resourcePermissions = user.permissions?.[requiredPermission.resource];
    const hasPermission = resourcePermissions && (
      resourcePermissions.includes(requiredPermission.action) ||
      resourcePermissions.includes('all')
    );
    if (!hasPermission) {
      return <Navigate to="/dashboard" replace state={{ message: 'You do not have permission to access this page.' }} />;
    }
  }

  // If no specific permissions required, allow access
  if (allowedRoles.length === 0) {
    return children;
  }

  // Check if user's role is in the allowed roles
  if (allowedRoles.includes(user.role)) {
    return children;
  }

  // Access denied
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">
          You don't have permission to access this page.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Required role: {allowedRoles.join(', ')}
        </p>
        <p className="text-sm text-gray-500">
          Your role: {user.role}
        </p>
      </div>
    </div>
  );
};

export default ProtectedRoute;
