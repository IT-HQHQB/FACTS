import React from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui';

// Icon components
const CasesIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PersonIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const ApprovedIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const PendingIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ReworkIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TrendingUpIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const Dashboard = () => {
  const { user } = useAuth();

  const { data: dashboardData, isLoading } = useQuery(
    'dashboard-overview',
    () => axios.get('/api/dashboard/overview').then(res => res.data),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  const { data: recentActivities } = useQuery(
    'recent-activities',
    () => axios.get('/api/dashboard/recent-activities').then(res => res.data),
    {
      refetchInterval: 60000, // Refetch every minute
    }
  );

  const { data: pipelineData } = useQuery(
    'case-pipeline',
    () => axios.get('/api/dashboard/case-pipeline').then(res => res.data)
  );

  const getStatusColor = (status) => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-800',
      assigned: 'bg-blue-100 text-blue-800',
      in_counseling: 'bg-yellow-100 text-yellow-800',
      cover_letter_generated: 'bg-indigo-100 text-indigo-800',
      submitted_to_welfare: 'bg-purple-100 text-purple-800',
      welfare_approved: 'bg-green-100 text-green-800',
      welfare_rejected: 'bg-red-100 text-red-800',
      executive_approved: 'bg-green-100 text-green-800',
      executive_rejected: 'bg-red-100 text-red-800',
      finance_disbursement: 'bg-green-100 text-green-800',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    if (status.includes('approved')) return <ApprovedIcon />;
    if (status.includes('rejected')) return <ReworkIcon />;
    return <PendingIcon />;
  };

  const getRoleSpecificContent = () => {
    if (!dashboardData) return null;

    switch (user?.role) {
      case 'super_admin':
      case 'admin':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <Card.Header>
                <h3 className="text-lg font-semibold text-gray-900">User Statistics</h3>
              </Card.Header>
              <Card.Content>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Users:</span>
                    <span className="font-semibold">{dashboardData.userStats?.total_users || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Users:</span>
                    <span className="font-semibold">{dashboardData.userStats?.active_users || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">DCMs:</span>
                    <span className="font-semibold">{dashboardData.userStats?.dcm_count || 0}</span>
                  </div>
                </div>
              </Card.Content>
            </Card>
            <Card>
              <Card.Header>
                <h3 className="text-lg font-semibold text-gray-900">Recent Cases</h3>
              </Card.Header>
              <Card.Content>
                <div className="space-y-3">
                  {dashboardData.recentCases?.slice(0, 5).map((caseItem) => (
                    <div key={caseItem.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center space-x-3">
                        <CasesIcon className="text-primary-600" />
                        <div>
                          <p className="font-medium text-gray-900">{caseItem.case_number}</p>
                          <p className="text-sm text-gray-600">{caseItem.applicant_first_name} {caseItem.applicant_last_name}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(caseItem.status)}`}>
                        {caseItem.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>
          </div>
        );

      case 'dcm':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">My Assigned Cases</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Assigned:</span>
                  <span className="font-semibold">{dashboardData.assignedCases?.total_assigned || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">In Counseling:</span>
                  <span className="font-semibold">{dashboardData.assignedCases?.in_counseling || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ready for Review:</span>
                  <span className="font-semibold">{dashboardData.assignedCases?.submitted_for_review || 0}</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Assigned Cases</h3>
              <div className="space-y-3">
                {dashboardData.recentAssignedCases?.slice(0, 5).map((caseItem) => (
                  <div key={caseItem.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center space-x-3">
                      <CasesIcon className="text-primary-600" />
                      <div>
                        <p className="font-medium text-gray-900">{caseItem.case_number}</p>
                        <p className="text-sm text-gray-600">{caseItem.applicant_first_name} {caseItem.applicant_last_name}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(caseItem.status)}`}>
                      {caseItem.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'welfare_reviewer':
      case 'welfare':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending Review:</span>
                  <span className="font-semibold text-yellow-600">{dashboardData.reviewCases?.pending_review || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Approved:</span>
                  <span className="font-semibold text-green-600">{dashboardData.reviewCases?.approved_cases || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Rework:</span>
                  <span className="font-semibold text-red-600">{dashboardData.reviewCases?.rejected_cases || 0}</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cases Pending Review</h3>
              <div className="space-y-3">
                {dashboardData.pendingReviewCases?.slice(0, 5).map((caseItem) => (
                  <div key={caseItem.id} className="flex items-center space-x-3 py-2 border-b border-gray-100 last:border-b-0">
                    <PendingIcon className="text-yellow-600" />
                    <div>
                      <p className="font-medium text-gray-900">{caseItem.case_number}</p>
                      <p className="text-sm text-gray-600">{caseItem.applicant_first_name} {caseItem.applicant_last_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Welcome back, {user?.full_name || user?.username || 'User'}!
      </h1>
      <p className="text-gray-600 mb-8">
        Here's an overview of your case management activities.
      </p>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <div className="flex items-center">
            <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mr-4">
              <CasesIcon className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{dashboardData?.totalStats?.total_cases || 0}</p>
              <p className="text-gray-600">Total Cases</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mr-4">
              <ApprovedIcon className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {(dashboardData?.totalStats?.welfare_approved || 0) + (dashboardData?.totalStats?.executive_approved || 0)}
              </p>
              <p className="text-gray-600">Approved Cases</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center mr-4">
              <PendingIcon className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {(dashboardData?.totalStats?.submitted_to_welfare || 0) + (dashboardData?.totalStats?.welfare_approved || 0)}
              </p>
              <p className="text-gray-600">Pending Review</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mr-4">
              <TrendingUpIcon className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{dashboardData?.totalStats?.finance_disbursement || 0}</p>
              <p className="text-gray-600">Disbursed</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Role-specific content */}
      {getRoleSpecificContent()}

      {/* Recent Activities and Case Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3">
              {recentActivities?.activities?.slice(0, 8).map((activity) => (
                <div key={activity.id} className="flex items-center space-x-3 py-2 border-b border-gray-100 last:border-b-0">
                  <div className="text-primary-600">
                    {getStatusIcon(activity.to_status)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{activity.case_number} - {activity.to_status.replace('_', ' ')}</p>
                    <p className="text-sm text-gray-600">{activity.changed_by_first_name} {activity.changed_by_last_name} • {new Date(activity.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Case Pipeline</h3>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3">
              {pipelineData?.pipelineData?.map((item) => (
                <div key={item.status} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <CasesIcon className="text-primary-600" />
                    <div>
                      <p className="font-medium text-gray-900">{item.status.replace('_', ' ').toUpperCase()}</p>
                      <p className="text-sm text-gray-600">{item.count} cases</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;