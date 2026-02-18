import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import CaseDetails from './pages/CaseDetails';
import Applicants from './pages/Applicants';
import CounselingForm from './pages/CounselingForm';
import CounselingFormsList from './pages/CounselingFormsList';
import Users from './pages/Users';
import RoleManagement from './pages/RoleManagement';
import JamiatMaster from './pages/JamiatMaster';
import CaseTypes from './pages/CaseTypes';
import Relations from './pages/Relations';
import EducationLevels from './pages/EducationLevels';
import Occupations from './pages/Occupations';
import BusinessAssetsPage from './pages/BusinessAssetsPage';
import ExecutiveLevels from './pages/ExecutiveLevels';
import WorkflowStages from './pages/WorkflowStages';
import WelfareChecklistCategories from './pages/WelfareChecklistCategories';
import WelfareChecklistItems from './pages/WelfareChecklistItems';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import PaymentSchedulePage from './pages/PaymentSchedulePage';
import CaseIdentification from './pages/CaseIdentification';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Simple authentication check component
const AuthCheck = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route Component (redirect to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Default Route Component (redirect to dashboard if logged in, otherwise to login)
const DefaultRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />

            {/* Protected Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/cases" 
              element={
                <ProtectedRoute requiredAnyOfPermissions={[{ resource: 'cases', action: 'read' }, { resource: 'cases', action: 'case_assigned' }]}>
                  <Layout>
                    <Cases />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/cases/:caseId" 
              element={
                <ProtectedRoute requiredAnyOfPermissions={[{ resource: 'cases', action: 'read' }, { resource: 'cases', action: 'case_assigned' }]}>
                  <Layout>
                    <CaseDetails />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/cases/:caseId/payment-schedule" 
              element={
                <ProtectedRoute requiredAnyOfPermissions={[{ resource: 'cases', action: 'read' }, { resource: 'cases', action: 'case_assigned' }]}>
                  <Layout>
                    <PaymentSchedulePage />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/applicants" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'applicants', action: 'read' }}>
                  <Layout>
                    <Applicants />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/case-identification" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <CaseIdentification />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/counseling-forms" 
              element={
                <AuthCheck>
                  <ProtectedRoute requireCounselingFormAccess={true}>
                    <Layout>
                      <CounselingFormsList />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/counseling-form/:caseId" 
              element={
                <AuthCheck>
                  <ProtectedRoute requireCounselingFormAccess={true}>
                    <Layout>
                      <CounselingForm />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/users"
              element={
                <AuthCheck>
                  <ProtectedRoute requireAdminAccess={true}>
                    <Layout>
                      <Users />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/roles" 
              element={
                <AuthCheck>
                  <ProtectedRoute requireAdminAccess={true}>
                    <Layout>
                      <RoleManagement />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/jamiat-master" 
              element={
                <AuthCheck>
                  <ProtectedRoute requireAdminAccess={true}>
                    <Layout>
                      <JamiatMaster />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/case-types" 
              element={
                <AuthCheck>
                  <ProtectedRoute requireAdminAccess={true}>
                    <Layout>
                      <CaseTypes />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/relations" 
              element={
                <AuthCheck>
                  <ProtectedRoute requireAdminAccess={true}>
                    <Layout>
                      <Relations />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/education-levels" 
              element={
                <AuthCheck>
                  <ProtectedRoute requireAdminAccess={true}>
                    <Layout>
                      <EducationLevels />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/occupations" 
              element={
                <AuthCheck>
                  <ProtectedRoute requireAdminAccess={true}>
                    <Layout>
                      <Occupations />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/business-assets/:caseId" 
              element={
                <AuthCheck>
                  <ProtectedRoute requireCounselingFormAccess={true}>
                    <Layout>
                      <BusinessAssetsPage />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/executive-levels" 
              element={
                <AuthCheck>
                  <ProtectedRoute requireRoles={['super_admin', 'admin']}>
                    <Layout>
                      <ExecutiveLevels />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/workflow-stages" 
              element={
                <AuthCheck>
                  <ProtectedRoute requireRoles={['super_admin', 'admin']}>
                    <Layout>
                      <WorkflowStages />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/welfare-checklist-categories" 
              element={
                <AuthCheck>
                  <ProtectedRoute requireRoles={['super_admin', 'admin']}>
                    <Layout>
                      <WelfareChecklistCategories />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/welfare-checklist-items" 
              element={
                <AuthCheck>
                  <ProtectedRoute requireRoles={['super_admin', 'admin']}>
                    <Layout>
                      <WelfareChecklistItems />
                    </Layout>
                  </ProtectedRoute>
                </AuthCheck>
              } 
            />

            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/notifications" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <Notifications />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/reports" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <Reports />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            {/* Default redirect */}
            <Route path="/" element={<DefaultRoute />} />
            
            {/* 404 route */}
            <Route 
              path="*" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <div className="p-6 text-center">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">404 - Page Not Found</h1>
                      <p className="text-gray-600">The page you're looking for doesn't exist.</p>
                    </div>
                  </Layout>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
