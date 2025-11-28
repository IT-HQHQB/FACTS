import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Icon components (you can replace these with your preferred icon library)
const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
  </svg>
);

const CasesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PersonIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const PeopleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
);

const FormIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const NotificationsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.828 7l2.586 2.586a2 2 0 002.828 0L12.828 7H4.828z" />
  </svg>
);

const ReportsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const ProfileIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const SecurityIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const CaseTypeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const PriorityIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const RelationsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const EducationIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
  </svg>
);

const OccupationIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
  </svg>
);

const ExecutiveLevelIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const WorkflowIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const MasterIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const AdminIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const drawerWidth = 208;

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openDropdowns, setOpenDropdowns] = useState({});

  // Check if any child path is active
  const isDropdownActive = (children) => {
    return children?.some(child => {
      if (child.children) {
        return isDropdownActive(child.children);
      }
      return location.pathname === child.path || location.pathname.startsWith(child.path + '/');
    });
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleProfileMenuClose();
  };

  const handleNavigation = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const toggleDropdown = (dropdownKey) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [dropdownKey]: !prev[dropdownKey]
    }));
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      super_admin: 'Super Administrator',
      admin: 'Administrator',
      dcm: 'Deputy Case Manager',
      counselor: 'Counselor',
      welfare_reviewer: 'Welfare Reviewer',
      executive: 'Executive',
      finance: 'Finance',
    };
    return roleNames[role] || role;
  };

  const getNavigationItems = () => {
    const baseItems = [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', color: 'text-blue-500' },
      { text: 'Cases', icon: <CasesIcon />, path: '/cases', color: 'text-purple-500' },
      { text: 'Applicants', icon: <PersonIcon />, path: '/applicants', color: 'text-green-500' },
    ];

    // Administration dropdown items
    const adminItems = [];
    if (user?.role === 'super_admin' || user?.role === 'Super Administrator' || user?.role === 'admin') {
      adminItems.push(
        { text: 'Users', icon: <PeopleIcon />, path: '/users', color: 'text-indigo-500' },
        { text: 'Role Management', icon: <SecurityIcon />, path: '/roles', color: 'text-red-500' }
      );
    }

    // Master dropdown items
    const masterItems = [];
    if (user?.role === 'super_admin' || user?.role === 'Super Administrator' || user?.role === 'admin') {
      masterItems.push(
        { text: 'Jamiat Master', icon: <SettingsIcon />, path: '/jamiat-master', color: 'text-orange-500' },
        { text: 'Case Types', icon: <CaseTypeIcon />, path: '/case-types', color: 'text-pink-500' },
        { text: 'Relations', icon: <RelationsIcon />, path: '/relations', color: 'text-cyan-500' },
        { text: 'Education Levels', icon: <EducationIcon />, path: '/education-levels', color: 'text-emerald-500' },
        { text: 'Occupations', icon: <OccupationIcon />, path: '/occupations', color: 'text-amber-500' },
        { text: 'Executive Levels', icon: <ExecutiveLevelIcon />, path: '/executive-levels', color: 'text-teal-500' },
        { text: 'Workflow Stages', icon: <WorkflowIcon />, path: '/workflow-stages', color: 'text-violet-500' }
      );
    }

    // Add Counseling Forms to Master for super admin
    if (user?.role === 'super_admin' || user?.role === 'Super Administrator') {
      masterItems.push(
        { text: 'Counseling Forms', icon: <FormIcon />, path: '/counseling-forms', color: 'text-rose-500' },
        { text: 'Checklist Categories', icon: <FormIcon />, path: '/welfare-checklist-categories', color: 'text-sky-500' },
        { text: 'Checklist Items', icon: <FormIcon />, path: '/welfare-checklist-items', color: 'text-lime-500' }
      );
    } else if (['dcm', 'counselor', 'admin'].includes(user?.role)) {
      // For other roles, add Counseling Forms as a regular item or under Master
      if (user?.role === 'admin') {
        masterItems.push({ text: 'Counseling Forms', icon: <FormIcon />, path: '/counseling-forms', color: 'text-rose-500' });
      } else {
        baseItems.push({ text: 'Counseling Forms', icon: <FormIcon />, path: '/counseling-forms', color: 'text-rose-500' });
      }
    }

    // Add Administration dropdown if it has items
    if (adminItems.length > 0) {
      baseItems.push({
        text: 'Administration',
        icon: <AdminIcon />,
        path: null,
        isDropdown: true,
        children: adminItems,
        color: 'text-indigo-600'
      });
    }

    // Add Master dropdown if it has items
    if (masterItems.length > 0) {
      baseItems.push({
        text: 'Master',
        icon: <MasterIcon />,
        path: null,
        isDropdown: true,
        children: masterItems,
        color: 'text-orange-600'
      });
    }

    baseItems.push(
      { text: 'Notifications', icon: <NotificationsIcon />, path: '/notifications', color: 'text-blue-600' },
      { text: 'Reports', icon: <ReportsIcon />, path: '/reports', color: 'text-green-600' }
    );

    return baseItems;
  };

  // Auto-open dropdowns that have active children
  useEffect(() => {
    const items = getNavigationItems();
    const newOpenDropdowns = {};
    items.forEach(item => {
      if (item.isDropdown && item.children && isDropdownActive(item.children)) {
        newOpenDropdowns[item.text] = true;
      }
    });
    if (Object.keys(newOpenDropdowns).length > 0) {
      setOpenDropdowns(prev => ({ ...prev, ...newOpenDropdowns }));
    }
  }, [location.pathname, user?.role]);

  const renderNavItem = (item) => {
    const isActive = item.path && (location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
    const hasActiveChild = item.isDropdown && isDropdownActive(item.children);
    // Auto-open dropdown if it has an active child, or if manually toggled
    const isDropdownOpen = openDropdowns[item.text] !== undefined 
      ? openDropdowns[item.text] 
      : (item.isDropdown && hasActiveChild);

    if (item.isDropdown) {
      return (
        <div key={item.text} className="px-2">
          <button
            onClick={() => toggleDropdown(item.text)}
            className={`w-full flex items-center justify-between px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
              hasActiveChild
                ? 'bg-primary-50 text-primary-600 border-l-4 border-primary-600 shadow-sm'
                : 'text-gray-700 hover:bg-gray-100 hover:text-primary-600 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center">
              <span className={`mr-3 ${hasActiveChild ? item.color || 'text-primary-600' : item.color || 'text-gray-500'}`}>
                {item.icon}
              </span>
              {item.text}
            </div>
            <span className="ml-auto">
              {isDropdownOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </span>
          </button>
          {isDropdownOpen && item.children && (
            <div className="ml-4 mt-1 space-y-1">
              {item.children.map((child) => {
                const isChildActive = location.pathname === child.path || location.pathname.startsWith(child.path + '/');
                return (
                  <button
                    key={child.text}
                    onClick={() => handleNavigation(child.path)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isChildActive
                        ? 'bg-primary-50 text-primary-600 border-l-4 border-primary-600 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-primary-600'
                    }`}
                  >
                    <span className={`mr-3 ${isChildActive ? child.color || 'text-primary-600' : child.color || 'text-gray-400'}`}>
                      {child.icon}
                    </span>
                    {child.text}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={item.text} className="px-2">
        <button
          onClick={() => handleNavigation(item.path)}
          className={`w-full flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
            isActive
              ? 'bg-primary-50 text-primary-600 border-l-4 border-primary-600 shadow-sm'
              : 'text-gray-700 hover:bg-gray-100 hover:text-primary-600 hover:shadow-sm'
          }`}
        >
          <span className={`mr-3 ${isActive ? item.color || 'text-primary-600' : item.color || 'text-gray-500'}`}>
            {item.icon}
          </span>
          {item.text}
        </button>
      </div>
    );
  };

  const drawer = (
    <div>
      <div className="flex items-center justify-center h-16 px-4">
        <h1 className="text-xl font-bold text-primary-600">FACTS</h1>
      </div>
      <div className="border-t border-gray-200"></div>
      <nav className="mt-4">
        {getNavigationItems().map((item) => renderNavItem(item))}
      </nav>
    </div>
  );

  return (
    <div className="flex">
      {/* App Bar */}
      <div className={`fixed top-0 right-0 z-40 bg-primary-600 text-white shadow-xl border-b border-primary-700 transition-all duration-300 ${
        mobileOpen ? 'left-0' : 'left-0 md:left-52'
      }`}>
        <div className="flex items-center justify-between h-16 px-4">
          <button
            onClick={handleDrawerToggle}
            className="md:hidden p-2 rounded-md text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <MenuIcon />
          </button>
          
          <h2 className="text-lg font-semibold flex-1 text-center md:text-left">
            {(() => {
              const items = getNavigationItems();
              // Check regular items first
              const regularItem = items.find(item => item.path === location.pathname);
              if (regularItem) return regularItem.text;
              
              // Check nested items in dropdowns
              for (const item of items) {
                if (item.children) {
                  const childItem = item.children.find(child => child.path === location.pathname || location.pathname.startsWith(child.path + '/'));
                  if (childItem) return childItem.text;
                }
              }
              
              return 'FACTS';
            })()}
          </h2>

          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-white hover:bg-primary-700 rounded-md focus:outline-none focus:ring-2 focus:ring-white">
              <NotificationsIcon />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                4
              </span>
            </button>
            
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-primary-600 font-semibold text-sm">
                {user?.full_name?.[0] || user?.username?.[0] || 'U'}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">{user?.full_name || user?.username || 'User'}</p>
                <p className="text-xs text-primary-200">{getRoleDisplayName(user?.role)}</p>
              </div>
              <button
                onClick={handleProfileMenuOpen}
                className="p-1 text-white hover:bg-primary-700 rounded-md focus:outline-none focus:ring-2 focus:ring-white"
              >
                <SettingsIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleDrawerToggle}></div>
        <div className="fixed left-0 top-0 h-full w-52 bg-white shadow-xl z-50">
          {drawer}
        </div>
      </div>

      {/* Desktop Drawer */}
      <div className="hidden md:block fixed left-0 top-0 h-full w-52 bg-white border-r border-gray-200 shadow-lg z-30">
        {drawer}
      </div>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${
        mobileOpen ? 'ml-0' : 'ml-0 md:ml-52'
      }`}>
        <div className="pt-16 px-2 py-6">
          {children}
        </div>
      </div>

      {/* Profile Menu */}
      {anchorEl && (
        <div className="fixed inset-0 z-50" onClick={handleProfileMenuClose}>
          <div className="absolute top-16 right-4 bg-white rounded-lg shadow-lg border border-gray-200 py-2 w-48">
            <button
              onClick={() => handleNavigation('/profile')}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <ProfileIcon />
              <span className="ml-3">Profile</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <LogoutIcon />
              <span className="ml-3">Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;