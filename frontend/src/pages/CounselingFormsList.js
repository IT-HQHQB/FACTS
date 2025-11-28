import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import axios from 'axios';
import { 
  Button, 
  Input, 
  Card, 
  Select, 
  Alert,
  Badge,
  Table
} from '../components/ui';

const CounselingFormsList = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch cases with counseling forms
  const { data: casesData, isLoading, error } = useQuery(
    'cases-with-counseling-forms',
    () => axios.get('/api/cases').then(res => res.data),
    {
      select: (data) => data.cases || [],
    }
  );

  // Fetch counseling forms stats
  const { data: statsData } = useQuery(
    'counseling-forms-stats',
    () => axios.get('/api/counseling-forms/stats').then(res => res.data),
    {
      select: (data) => data.stats || {},
    }
  );

  const filteredCases = casesData?.filter(caseItem => {
    const matchesSearch = 
      caseItem.applicant_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.its_number?.includes(searchTerm) ||
      caseItem.case_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'completed' && caseItem.counseling_form_completed) ||
      (statusFilter === 'in_progress' && caseItem.status === 'in_counseling') ||
      (statusFilter === 'not_started' && !caseItem.counseling_form_completed && caseItem.status !== 'in_counseling');

    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusBadge = (caseItem) => {
    if (caseItem.counseling_form_completed) {
      return <Badge variant="success">Completed</Badge>;
    } else if (caseItem.status === 'in_counseling') {
      return <Badge variant="warning">In Progress</Badge>;
    } else {
      return <Badge variant="secondary">Not Started</Badge>;
    }
  };

  const handleViewForm = (caseId) => {
    navigate(`/counseling-form/${caseId}`);
  };

  const handleStartForm = (caseId) => {
    navigate(`/counseling-form/${caseId}`);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="error">
          Failed to load counseling forms: {error.message}
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Counseling Forms</h1>
        <p className="text-gray-600">Manage and track counseling form progress</p>
      </div>

      {/* Stats Cards */}
      {statsData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Forms</p>
                <p className="text-2xl font-semibold text-gray-900">{statsData.total_forms || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-semibold text-gray-900">{statsData.completed_forms || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-full">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-semibold text-gray-900">{statsData.incomplete_forms || 0}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by applicant name, ITS number, or case number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="not_started">Not Started</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Cases Table */}
      <Card className="p-6">
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <th>Case Number</th>
                <th>Applicant Name</th>
                <th>ITS Number</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    No cases found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredCases.map((caseItem) => (
                  <tr key={caseItem.id}>
                    <td className="font-medium">{caseItem.case_number}</td>
                    <td>{caseItem.applicant_full_name}</td>
                    <td>{caseItem.its_number}</td>
                    <td>{getStatusBadge(caseItem)}</td>
                    <td>
                      <div>
                        <div className="text-sm font-medium">
                          {caseItem.counselor_full_name || 'Unassigned'}
                        </div>
                        {caseItem.dcm_full_name && (
                          <div className="text-xs text-gray-500">
                            DCM: {caseItem.dcm_full_name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{new Date(caseItem.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="flex space-x-2">
                        {caseItem.counseling_form_completed ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewForm(caseItem.id)}
                          >
                            View Form
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleStartForm(caseItem.id)}
                          >
                            {caseItem.status === 'in_counseling' ? 'Continue Form' : 'Start Form'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default CounselingFormsList;
