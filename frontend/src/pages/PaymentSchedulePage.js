import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import axios from 'axios';
import { usePermission } from '../utils/permissionUtils';
import PaymentSchedule from '../components/PaymentSchedule';
import { Button, Card, Alert } from '../components/ui';

const ArrowLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const PaymentSchedulePage = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();

  // Fetch case data to show case number and verify access
  const { data: caseData, isLoading, error } = useQuery(
    ['case', caseId],
    () => axios.get(`/api/cases/${caseId}`).then(res => res.data),
    { enabled: !!caseId }
  );
  // Payment management permissions (must be declared before any early returns)
  const { hasPermission: hasPaymentManagementRead } = usePermission('payment_management', 'read');
  const { hasPermission: hasPaymentManagementUpdate } = usePermission('payment_management', 'update');

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert severity="error">
          Error loading case: {error.message}
        </Alert>
      </div>
    );
  }

  if (!caseData?.case) {
    return (
      <div className="p-6">
        <Alert severity="error">
          Case not found
        </Alert>
      </div>
    );
  }

  const caseItem = caseData.case;
  const isFinanceStage = caseItem.status_name === 'finance_disbursement';

  const canViewPayment = hasPaymentManagementRead && isFinanceStage;
  const canEditPayment = hasPaymentManagementUpdate && isFinanceStage;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => navigate(`/cases/${caseId}`)}
              className="flex items-center space-x-2"
            >
              <ArrowLeftIcon />
              <span>Back to Case Details</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Payment Schedule - Case {caseItem.case_number}
              </h1>
              <p className="text-gray-600">
                Manage payment schedules for Qardan Hasana and Enayat
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Permission / stage alerts */}
      {!isFinanceStage && (
        <Alert severity="warning" className="mb-6">
          This case is not in the finance disbursement stage. Payment schedules can only be managed when the case reaches the finance disbursement stage.
        </Alert>
      )}
      {isFinanceStage && !hasPaymentManagementRead && (
        <Alert severity="error" className="mb-6">
          You do not have permission to view the payment schedule for this case. Please contact an administrator to request Payment Management access.
        </Alert>
      )}

      {/* Payment Schedule Component */}
      {canViewPayment && (
        <PaymentSchedule 
          caseId={caseId}
          isViewOnly={!canEditPayment}
          caseDetails={caseItem}
        />
      )}
    </div>
  );
};

export default PaymentSchedulePage;

