import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Use ref to track if we're checking auth (to avoid infinite loops)
  const isCheckingAuthRef = useRef(false);
  
  // Logout function
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  // Set up axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Set up response interceptor once on mount
  useEffect(() => {
    // Add response interceptor to handle 401/403 errors globally
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle 401/403 errors - these mean token is invalid/expired
        // Note: We don't logout here to avoid conflicts with checkAuth
        // The checkAuth function will handle logout for these errors
        // This interceptor is mainly for other API calls
        return Promise.reject(error);
      }
    );

    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Check if user is logged in on app start
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        isCheckingAuthRef.current = true;
        try {
          const response = await axios.get('/api/auth/profile');
          setUser(response.data.user);
        } catch (error) {
          // Handle 401/403 errors silently (token expired or invalid)
          // These are expected when token is invalid, so we just logout
          if (error.response?.status === 401 || error.response?.status === 403) {
            // Token is invalid or expired, silently logout
            // Don't log or throw - this is expected behavior
            logout();
          } else {
            // Log other errors for debugging
            console.error('Auth check failed:', error);
            logout();
          }
        } finally {
          isCheckingAuthRef.current = false;
        }
      }
      setLoading(false);
    };

    // Wrap in promise to ensure errors don't propagate to React's error boundary
    checkAuth().catch(() => {
      // Errors are already handled in checkAuth, this is just to prevent unhandled rejections
    });
  }, [token]);

  const login = async (username, password) => {
    try {
      const response = await axios.post('/api/auth/login', {
        username,
        password,
      });

      const { token: newToken, user: userData } = response.data;
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      const data = error.response?.data;
      const errorMessage =
        (data && typeof data === 'object' && data.error) ||
        (typeof data === 'string' ? data : null) ||
        'Login failed';
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put('/api/auth/profile', profileData);
      setUser(prevUser => ({ ...prevUser, ...profileData }));
      return { success: true };
    } catch (error) {
      console.error('Profile update failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Profile update failed' 
      };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.put('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      return { success: true };
    } catch (error) {
      console.error('Password change failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Password change failed' 
      };
    }
  };

  const setPrimaryRole = async (role) => {
    try {
      await axios.patch('/api/users/me/primary-role', { role });
      setUser(prev => (prev ? { ...prev, role } : null));
      return { success: true };
    } catch (error) {
      console.error('Set primary role failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Failed to switch role' 
      };
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    updateProfile,
    changePassword,
    setPrimaryRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
