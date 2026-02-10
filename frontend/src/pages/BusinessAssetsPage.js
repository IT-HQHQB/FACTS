import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import axios from 'axios';
import BusinessAssets from '../components/BusinessAssets';
import { Card, Alert, Button } from '../components/ui';

const BusinessAssetsPage = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  // Fetch case details
  const { data: caseData, isLoading: caseLoading } = useQuery(
    ['case', caseId],
    () => axios.get(`/api/cases/${caseId}`).then(res => res.data),
    {
      enabled: !!caseId,
      onError: (error) => {
        setError('Failed to load case details');
        console.error('Error fetching case:', error);
      }
    }
  );

  const handleSave = () => {
    // Optionally show success message or navigate
  };

  const handleCancel = () => {
    navigate(`/cases/${caseId}`);
  };

  if (caseLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-600">Loading case details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert type="error" message={error} />
        <div className="mt-4">
          <Button onClick={() => navigate(`/cases?search=${encodeURIComponent(caseId || '')}`)}>
            Back to Cases
          </Button>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert type="error" message="Case not found" />
        <div className="mt-4">
          <Button onClick={() => navigate(`/cases?search=${encodeURIComponent(caseId || '')}`)}>
            Back to Cases
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Business Assets - Workflow 5
            </h1>
            <p className="text-gray-600 mt-2">
              Case: {caseData.case_number} - {caseData.applicant?.first_name} {caseData.applicant?.last_name}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(`/cases/${caseId}`)}
          >
            Back to Case
          </Button>
        </div>
      </div>

      {/* Business Assets Form */}
      <BusinessAssets
        caseId={caseId}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default BusinessAssetsPage;
