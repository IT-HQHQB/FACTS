import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { Button, Card, Input, Select, Modal, Alert } from './ui';

// Helper functions moved outside component to prevent re-creation on each render
const getQHYearLabel = (yearNum) => {
  switch (yearNum) {
    case 1:
      return 'QH Year 1';
    case 2:
      return 'QH Year 2';
    case 3:
      return 'QH Year 3';
    case 4:
      return 'QH Year 4';
    case 5:
      return 'QH Year 5';
    default:
      return '';
  }
};

const getEnayatYearLabel = (yearNum) => {
  switch (yearNum) {
    case 1:
      return 'Enayat Year 1';
    case 2:
      return 'Enayat Year 2';
    case 3:
      return 'Enayat Year 3';
    case 4:
      return 'Enayat Year 4';
    case 5:
      return 'Enayat Year 5';
    default:
      return '';
  }
};

const getQHRepaymentLabel = (yearNum) => {
  switch (yearNum) {
    case 1:
      return 'Repayments (QH Year 1)';
    case 2:
      return 'Repayments (QH Year 2)';
    case 3:
      return 'Repayments (QH Year 3)';
    case 4:
      return 'Repayments (QH Year 4)';
    case 5:
      return 'Repayments (QH Year 5)';
    default:
      return '';
  }
};

const PaymentSchedule = ({ caseId, isViewOnly = false, caseDetails = null }) => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDisbursementModal, setShowDisbursementModal] = useState(false);
  const [disbursementModalData, setDisbursementModalData] = useState(null);

  // Fetch payment schedule
  const { data: scheduleData, isLoading } = useQuery(
    ['payment-schedule', caseId],
    () => axios.get(`/api/cases/${caseId}/payment-schedule`).then(res => res.data),
    { enabled: !!caseId }
  );

  // Generate months for the timeline (60 months total, with conditional past months)
  const timelineMonths = useMemo(() => {
    const months = [];
    const today = new Date();
    const totalMonthsToShow = 60;

    // Determine start offset: for new cases in finance disbursement stage, start from current month (0)
    // Otherwise, show 6 past months for context (-6)
    let startMonthOffset = -6; // Default: show 6 past months
    
    const isNewCaseInFinanceStage = 
      caseDetails?.status_name === 'finance_disbursement' &&
      (!scheduleData?.schedules || scheduleData.schedules.length === 0);

    if (isNewCaseInFinanceStage) {
      startMonthOffset = 0; // Start from current month for new finance cases
    }

    for (let i = startMonthOffset; i < startMonthOffset + totalMonthsToShow; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const year = date.getFullYear();
      months.push({
        key: `${year}-${date.getMonth() + 1}`,
        label: `${monthName} '${year.toString().slice(-2)}`,
        year,
        month: date.getMonth() + 1
      });
    }
    return months;
  }, [caseDetails, scheduleData]);

  // Save payment schedule mutation
  const saveMutation = useMutation(
    (schedules) => axios.post(`/api/cases/${caseId}/payment-schedule`, { schedules }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['payment-schedule', caseId]);
        setShowModal(false);
        setModalData(null);
        setSelectedCell(null);
      }
    }
  );

  // Confirm disbursement mutation
  const confirmDisbursementMutation = useMutation(
    ({ scheduleId, disbursed_date, repayment_months }) => 
      axios.post(`/api/cases/${caseId}/payment-schedule/${scheduleId}/confirm-disbursement`, {
        disbursed_date,
        repayment_months
      }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['payment-schedule', caseId]);
        setShowDisbursementModal(false);
        setDisbursementModalData(null);
      }
    }
  );

  // Organize schedules by type and year
  const organizedSchedules = useMemo(() => {
    const schedules = scheduleData?.schedules || [];
    const organized = {
      qardan_hasana: {},
      enayat: {}
    };

    // Initialize years 1-5 for both types
    for (let year = 1; year <= 5; year++) {
      organized.qardan_hasana[year] = null;
      organized.enayat[year] = null;
    }

    // Populate with actual schedules
    schedules.forEach(schedule => {
      if (schedule.payment_type === 'qardan_hasana' || schedule.payment_type === 'enayat') {
        // Ensure year_number is a number (1-5) and use it as the key
        const yearKey = Number(schedule.year_number);
        if (yearKey >= 1 && yearKey <= 5 && yearKey === Math.floor(yearKey)) {
          organized[schedule.payment_type][yearKey] = schedule;
        } else {
          console.warn('Invalid year_number found:', schedule.year_number, 'for schedule:', schedule.id);
        }
      }
    });

    return organized;
  }, [scheduleData]);


  // Get cell value for a specific schedule and month
  // For QH main rows: Only show disbursement amount in disbursement month (not repayment amounts)
  // For Enayat rows: Show disbursement amount in disbursement month
  const getCellValue = (schedule, monthKey, isQHMainRow = false) => {
    if (!schedule) return null;

    // For QH main rows, only show the disbursement amount in the disbursement month
    // Don't show repayment amounts in the main row
    if (isQHMainRow && schedule.payment_type === 'qardan_hasana') {
      // Only return value if it's the disbursement month
      if (schedule.disbursement_year === monthKey.year && schedule.disbursement_month === monthKey.month) {
        return schedule.disbursement_amount;
      }
      return null; // Don't show repayment amounts in main QH row
    }

    // For Enayat, show disbursement amount in disbursement month
    if (schedule.payment_type === 'enayat') {
      if (schedule.disbursement_year === monthKey.year && schedule.disbursement_month === monthKey.month) {
        return schedule.disbursement_amount;
      }
    }

    return null;
  };

  // Handle cell click - only allow editing if not disbursed
  const handleCellClick = (paymentType, yearNumber, month, schedule) => {
    if (isViewOnly) return;
    
    // Don't allow editing if schedule is already disbursed
    if (schedule?.is_disbursed) {
      return;
    }

    setSelectedCell({ paymentType, yearNumber, month });
    
    if (schedule) {
      // Edit existing schedule
      setModalData({
        payment_type: paymentType,
        year_number: yearNumber,
        disbursement_year: schedule.disbursement_year,
        disbursement_month: schedule.disbursement_month,
        disbursement_amount: schedule.disbursement_amount,
        repayment_months: schedule.repayment_months || 12,
        repayment_start_year: schedule.repayment_start_year || month.year + 1,
        repayment_start_month: schedule.repayment_start_month || 1
      });
    } else {
      // New schedule
      setModalData({
        payment_type: paymentType,
        year_number: yearNumber,
        disbursement_year: month.year,
        disbursement_month: month.month,
        disbursement_amount: '',
        repayment_months: 12,
        repayment_start_year: month.year + 1,
        repayment_start_month: 1
      });
    }
    setShowModal(true);
  };

  // Handle confirm disbursement button click
  const handleConfirmDisbursement = (schedule) => {
    if (!schedule || schedule.is_disbursed) return;
    
    setDisbursementModalData({
      scheduleId: schedule.id,
      schedule: schedule,
      disbursed_date: schedule.disbursed_date || new Date().toISOString().split('T')[0],
      repayment_months: schedule.repayment_months || 12
    });
    setShowDisbursementModal(true);
  };

  // Handle disbursement confirmation save
  const handleConfirmDisbursementSave = () => {
    if (!disbursementModalData.disbursed_date) {
      alert('Please select a disbursement date');
      return;
    }

    if (disbursementModalData.schedule.payment_type === 'qardan_hasana' && !disbursementModalData.repayment_months) {
      alert('Please enter the number of repayment months');
      return;
    }

    confirmDisbursementMutation.mutate({
      scheduleId: disbursementModalData.scheduleId,
      disbursed_date: disbursementModalData.disbursed_date,
      repayment_months: disbursementModalData.schedule.payment_type === 'qardan_hasana' 
        ? parseInt(disbursementModalData.repayment_months) 
        : null
    });
  };

  // Handle save from modal
  const handleSave = () => {
    if (!modalData.disbursement_amount || parseFloat(modalData.disbursement_amount) <= 0) {
      alert('Please enter a valid disbursement amount');
      return;
    }

    const schedules = scheduleData?.schedules || [];
    
    // Check if trying to edit a disbursed schedule
    const existingDisbursed = schedules.find(
      s => s.is_disbursed && s.payment_type === modalData.payment_type && s.year_number === modalData.year_number
    );
    
    if (existingDisbursed) {
      alert('Cannot edit a disbursed schedule. Please use the Confirm Disbursement button to update.');
      return;
    }

    // Filter out ALL disbursed schedules - they should not be sent to backend
    // Backend already preserves them by not deleting them
    // Only include non-disbursed schedules, excluding the one being edited/created
    const filtered = schedules.filter(
      s => !s.is_disbursed && !(s.payment_type === modalData.payment_type && s.year_number === modalData.year_number)
    );

    const newSchedule = {
      payment_type: modalData.payment_type,
      year_number: modalData.year_number,
      disbursement_year: parseInt(modalData.disbursement_year),
      disbursement_month: parseInt(modalData.disbursement_month),
      disbursement_amount: parseFloat(modalData.disbursement_amount),
      repayment_months: modalData.payment_type === 'qardan_hasana' ? parseInt(modalData.repayment_months) : null,
      repayment_start_year: modalData.payment_type === 'qardan_hasana' ? parseInt(modalData.repayment_start_year) : null,
      repayment_start_month: modalData.payment_type === 'qardan_hasana' ? parseInt(modalData.repayment_start_month) : null
    };

    filtered.push(newSchedule);
    saveMutation.mutate(filtered);
  };

  // Handle remove schedule
  const handleRemove = (paymentType, yearNumber) => {
    setDeleteTarget({ paymentType, yearNumber });
    setShowDeleteConfirm(true);
  };

  // Confirm and execute deletion
  const confirmDelete = () => {
    if (!deleteTarget) return;

    const schedules = scheduleData?.schedules || [];
    
    // Check if trying to delete a disbursed schedule
    const scheduleToDelete = schedules.find(
      s => s.payment_type === deleteTarget.paymentType && s.year_number === deleteTarget.yearNumber
    );
    
    if (scheduleToDelete?.is_disbursed) {
      alert('Cannot delete a disbursed schedule. Please contact an administrator.');
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      return;
    }

    const filtered = schedules.filter(
      s => !(s.payment_type === deleteTarget.paymentType && s.year_number === deleteTarget.yearNumber)
    );
    saveMutation.mutate(filtered);
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  // Calculate totals - Sum QH Year 1-5 and Enayat Year 1-5 separately
  const totals = useMemo(() => {
    const schedules = scheduleData?.schedules || [];
    let totalQardanHasana = 0;
    let totalEnayat = 0;

    schedules.forEach(schedule => {
      const amount = parseFloat(schedule.disbursement_amount) || 0;
      if (schedule.payment_type === 'qardan_hasana' && schedule.year_number >= 1 && schedule.year_number <= 5) {
        totalQardanHasana += amount;
      } else if (schedule.payment_type === 'enayat' && schedule.year_number >= 1 && schedule.year_number <= 5) {
        totalEnayat += amount;
      }
    });

    return {
      totalQardanHasana,
      totalEnayat,
      totalBalance: 0 // Total Balance remains 0 as per requirements
    };
  }, [scheduleData]);

  if (isLoading) {
    return <div className="text-center py-4">Loading payment schedule...</div>;
  }

  return (
      <Card className="mt-6">
      <Card.Header>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Payment Schedule</h3>
        </div>
        {!isViewOnly && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700 mb-3">
              <strong>How to add a payment schedule:</strong> Click on any cell in the timeline below, or use the buttons to add a new payment entry.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  // Find next available year for QH
                  let nextYear = 1;
                  for (let i = 1; i <= 5; i++) {
                    if (!organizedSchedules.qardan_hasana[i]) {
                      nextYear = i;
                      break;
                    }
                  }
                  setModalData({
                    payment_type: 'qardan_hasana',
                    year_number: nextYear,
                    disbursement_year: new Date().getFullYear(),
                    disbursement_month: new Date().getMonth() + 1,
                    disbursement_amount: '',
                    repayment_months: 12,
                    repayment_start_year: new Date().getFullYear() + 1,
                    repayment_start_month: 1
                  });
                  setShowModal(true);
                }}
                className="flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Qardan Hasana</span>
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  // Find next available year for Enayat
                  let nextYear = 1;
                  for (let i = 1; i <= 5; i++) {
                    if (!organizedSchedules.enayat[i]) {
                      nextYear = i;
                      break;
                    }
                  }
                  setModalData({
                    payment_type: 'enayat',
                    year_number: nextYear,
                    disbursement_year: new Date().getFullYear(),
                    disbursement_month: new Date().getMonth() + 1,
                    disbursement_amount: '',
                    repayment_months: null,
                    repayment_start_year: null,
                    repayment_start_month: null
                  });
                  setShowModal(true);
                }}
                className="flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Enayat</span>
              </Button>
            </div>
          </div>
        )}
        {isViewOnly && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>View Only Mode:</strong> You don't have permission to edit payment schedules. Contact an administrator if you need edit access.
            </p>
          </div>
        )}
        
        {/* Budget Summary - Below the buttons */}
        <div className="flex items-center justify-start space-x-6 mt-4 pt-4 border-t border-gray-200">
          <div>
            <span className="text-sm text-gray-600">Total Qardan Hasana: </span>
            <span className="text-sm font-semibold text-gray-900">
              ₹{totals.totalQardanHasana.toLocaleString('en-IN')}
            </span>
          </div>
          <div>
            <span className="text-sm text-gray-600">Total Enayat: </span>
            <span className="text-sm font-semibold text-gray-900">
              ₹{totals.totalEnayat.toLocaleString('en-IN')}
            </span>
          </div>
          <div>
            <span className="text-sm text-gray-600">Total Balance: </span>
            <span className="text-sm font-semibold text-gray-900">
              ₹{totals.totalBalance.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </Card.Header>
      <Card.Content>
        <div className="overflow-x-auto">
          <div className="min-w-full" style={{ width: 'max-content' }}>
            {/* Timeline Header */}
            <div className="flex border-b border-gray-300 sticky top-0 bg-white z-10">
              <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 font-semibold text-sm bg-gray-50">
                Payment Type / Year
              </div>
              {timelineMonths.map(month => (
                <div
                  key={month.key}
                  className="w-24 flex-shrink-0 border-r border-gray-300 p-2 text-center text-xs font-medium bg-gray-50"
                >
                  {month.label}
                </div>
              ))}
            </div>

            {/* Qardan Hasana Rows */}
            {/* QH Year 1 */}
            {(() => {
              const yearNum = 1;
              const schedule = organizedSchedules.qardan_hasana[yearNum];
              const hasRepayments = schedule && schedule.payment_type === 'qardan_hasana' && schedule.repayments?.length > 0;
              return (
                <React.Fragment key="qh-1">
                  <div className="flex border-b border-gray-200 hover:bg-gray-50">
                    <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-white flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {!isViewOnly && schedule && !schedule.is_disbursed && (
                          <button
                            onClick={() => handleRemove('qardan_hasana', yearNum)}
                            className="text-red-500 hover:text-red-700"
                            title="Remove schedule"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        <span className="text-sm font-medium text-gray-900" data-year={yearNum}>
                          QH Year 1
                          {schedule?.is_disbursed && (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Disbursed</span>
                          )}
                        </span>
                      </div>
                      {!isViewOnly && schedule && !schedule.is_disbursed && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleConfirmDisbursement(schedule)}
                          className="ml-2 text-xs"
                        >
                          Confirm
                        </Button>
                      )}
                    </div>
                    {timelineMonths.map(month => {
                      const value = getCellValue(schedule, month, true);
                      const isDisbursement = schedule && 
                        schedule.disbursement_year === month.year && 
                        schedule.disbursement_month === month.month;
                      return (
                        <div
                          key={month.key}
                          onClick={() => !isViewOnly && !schedule?.is_disbursed && handleCellClick('qardan_hasana', yearNum, month, schedule)}
                          className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                            isDisbursement ? 'bg-blue-600 text-white font-semibold' :
                            schedule?.is_disbursed ? 'bg-gray-100 cursor-not-allowed' :
                            !isViewOnly ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300' : ''
                          }`}
                          title={schedule?.is_disbursed ? 'Disbursed - Cannot edit' : (!isViewOnly ? 'Click to add/edit payment' : '')}
                        >
                          {value ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : (!isViewOnly && !schedule?.is_disbursed ? 'Click' : '-')}
                        </div>
                      );
                    })}
                  </div>
                  {hasRepayments && (
                    <div className="flex border-b border-gray-200 hover:bg-gray-50">
                      <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-gray-50 flex items-center space-x-2">
                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span 
                          className="text-sm text-gray-600" 
                          data-year={yearNum}
                          dangerouslySetInnerHTML={{__html: 'Repayments (QH Year 1)'}}
                        />
                      </div>
                      {timelineMonths.map(month => {
                        const repayment = schedule.repayments?.find(
                          r => r.repayment_year === month.year && r.repayment_month === month.month
                        );
                        return (
                          <div
                            key={month.key}
                            className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                              repayment ? 'bg-blue-100 text-blue-900 font-semibold' : 'text-gray-400'
                            }`}
                          >
                            {repayment ? `₹${repayment.repayment_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : 'number'}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })()}

            {/* QH Year 2 */}
            {(() => {
              const yearNum = 2;
              const schedule = organizedSchedules.qardan_hasana[yearNum];
              const hasRepayments = schedule && schedule.payment_type === 'qardan_hasana' && schedule.repayments?.length > 0;
              return (
                <React.Fragment key="qh-2">
                  <div className="flex border-b border-gray-200 hover:bg-gray-50">
                    <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-white flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {!isViewOnly && schedule && !schedule.is_disbursed && (
                          <button
                            onClick={() => handleRemove('qardan_hasana', yearNum)}
                            className="text-red-500 hover:text-red-700"
                            title="Remove schedule"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        <span className="text-sm font-medium text-gray-900" data-year={yearNum}>
                          QH Year 2
                          {schedule?.is_disbursed && (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Disbursed</span>
                          )}
                        </span>
                      </div>
                      {!isViewOnly && schedule && !schedule.is_disbursed && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleConfirmDisbursement(schedule)}
                          className="ml-2 text-xs"
                        >
                          Confirm
                        </Button>
                      )}
                    </div>
                    {timelineMonths.map(month => {
                      const value = getCellValue(schedule, month, true);
                      const isDisbursement = schedule && 
                        schedule.disbursement_year === month.year && 
                        schedule.disbursement_month === month.month;
                      return (
                        <div
                          key={month.key}
                          onClick={() => !isViewOnly && !schedule?.is_disbursed && handleCellClick('qardan_hasana', yearNum, month, schedule)}
                          className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                            isDisbursement ? 'bg-blue-600 text-white font-semibold' :
                            schedule?.is_disbursed ? 'bg-gray-100 cursor-not-allowed' :
                            !isViewOnly ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300' : ''
                          }`}
                          title={schedule?.is_disbursed ? 'Disbursed - Cannot edit' : (!isViewOnly ? 'Click to add/edit payment' : '')}
                        >
                          {value ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : (!isViewOnly && !schedule?.is_disbursed ? 'Click' : '-')}
                        </div>
                      );
                    })}
                  </div>
                  {hasRepayments && (
                    <div className="flex border-b border-gray-200 hover:bg-gray-50">
                      <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-gray-50 flex items-center space-x-2">
                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span 
                          className="text-sm text-gray-600" 
                          data-year={yearNum}
                          dangerouslySetInnerHTML={{__html: 'Repayments (QH Year 2)'}}
                        />
                      </div>
                      {timelineMonths.map(month => {
                        const repayment = schedule.repayments?.find(
                          r => r.repayment_year === month.year && r.repayment_month === month.month
                        );
                        return (
                          <div
                            key={month.key}
                            className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                              repayment ? 'bg-blue-100 text-blue-900 font-semibold' : 'text-gray-400'
                            }`}
                          >
                            {repayment ? `₹${repayment.repayment_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : 'number'}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })()}

            {/* QH Year 3 */}
            {(() => {
              const yearNum = 3;
              const schedule = organizedSchedules.qardan_hasana[yearNum];
              const hasRepayments = schedule && schedule.payment_type === 'qardan_hasana' && schedule.repayments?.length > 0;
              return (
                <React.Fragment key="qh-3">
                  <div className="flex border-b border-gray-200 hover:bg-gray-50">
                    <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-white flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {!isViewOnly && schedule && !schedule.is_disbursed && (
                          <button
                            onClick={() => handleRemove('qardan_hasana', yearNum)}
                            className="text-red-500 hover:text-red-700"
                            title="Remove schedule"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        <span className="text-sm font-medium text-gray-900" data-year={yearNum}>
                          QH Year 3
                          {schedule?.is_disbursed && (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Disbursed</span>
                          )}
                        </span>
                      </div>
                      {!isViewOnly && schedule && !schedule.is_disbursed && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleConfirmDisbursement(schedule)}
                          className="ml-2 text-xs"
                        >
                          Confirm
                        </Button>
                      )}
                    </div>
                    {timelineMonths.map(month => {
                      const value = getCellValue(schedule, month, true);
                      const isDisbursement = schedule && 
                        schedule.disbursement_year === month.year && 
                        schedule.disbursement_month === month.month;
                      return (
                        <div
                          key={month.key}
                          onClick={() => !isViewOnly && !schedule?.is_disbursed && handleCellClick('qardan_hasana', yearNum, month, schedule)}
                          className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                            isDisbursement ? 'bg-blue-600 text-white font-semibold' :
                            schedule?.is_disbursed ? 'bg-gray-100 cursor-not-allowed' :
                            !isViewOnly ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300' : ''
                          }`}
                          title={schedule?.is_disbursed ? 'Disbursed - Cannot edit' : (!isViewOnly ? 'Click to add/edit payment' : '')}
                        >
                          {value ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : (!isViewOnly && !schedule?.is_disbursed ? 'Click' : '-')}
                        </div>
                      );
                    })}
                  </div>
                  {hasRepayments && (
                    <div className="flex border-b border-gray-200 hover:bg-gray-50">
                      <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-gray-50 flex items-center space-x-2">
                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span 
                          className="text-sm text-gray-600" 
                          data-year={yearNum}
                          dangerouslySetInnerHTML={{__html: 'Repayments (QH Year 3)'}}
                        />
                      </div>
                      {timelineMonths.map(month => {
                        const repayment = schedule.repayments?.find(
                          r => r.repayment_year === month.year && r.repayment_month === month.month
                        );
                        return (
                          <div
                            key={month.key}
                            className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                              repayment ? 'bg-blue-100 text-blue-900 font-semibold' : 'text-gray-400'
                            }`}
                          >
                            {repayment ? `₹${repayment.repayment_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : 'number'}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })()}

            {/* QH Year 4 */}
            {(() => {
              const yearNum = 4;
              const schedule = organizedSchedules.qardan_hasana[yearNum];
              const hasRepayments = schedule && schedule.payment_type === 'qardan_hasana' && schedule.repayments?.length > 0;
              return (
                <React.Fragment key="qh-4">
                  <div className="flex border-b border-gray-200 hover:bg-gray-50">
                    <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-white flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {!isViewOnly && schedule && !schedule.is_disbursed && (
                          <button
                            onClick={() => handleRemove('qardan_hasana', yearNum)}
                            className="text-red-500 hover:text-red-700"
                            title="Remove schedule"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        <span className="text-sm font-medium text-gray-900" data-year={yearNum}>
                          QH Year 4
                          {schedule?.is_disbursed && (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Disbursed</span>
                          )}
                        </span>
                      </div>
                      {!isViewOnly && schedule && !schedule.is_disbursed && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleConfirmDisbursement(schedule)}
                          className="ml-2 text-xs"
                        >
                          Confirm
                        </Button>
                      )}
                    </div>
                    {timelineMonths.map(month => {
                      const value = getCellValue(schedule, month, true);
                      const isDisbursement = schedule && 
                        schedule.disbursement_year === month.year && 
                        schedule.disbursement_month === month.month;
                      return (
                        <div
                          key={month.key}
                          onClick={() => !isViewOnly && !schedule?.is_disbursed && handleCellClick('qardan_hasana', yearNum, month, schedule)}
                          className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                            isDisbursement ? 'bg-blue-600 text-white font-semibold' :
                            schedule?.is_disbursed ? 'bg-gray-100 cursor-not-allowed' :
                            !isViewOnly ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300' : ''
                          }`}
                          title={schedule?.is_disbursed ? 'Disbursed - Cannot edit' : (!isViewOnly ? 'Click to add/edit payment' : '')}
                        >
                          {value ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : (!isViewOnly && !schedule?.is_disbursed ? 'Click' : '-')}
                        </div>
                      );
                    })}
                  </div>
                  {hasRepayments && (
                    <div className="flex border-b border-gray-200 hover:bg-gray-50">
                      <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-gray-50 flex items-center space-x-2">
                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span 
                          className="text-sm text-gray-600" 
                          data-year={yearNum}
                          dangerouslySetInnerHTML={{__html: 'Repayments (QH Year 4)'}}
                        />
                      </div>
                      {timelineMonths.map(month => {
                        const repayment = schedule.repayments?.find(
                          r => r.repayment_year === month.year && r.repayment_month === month.month
                        );
                        return (
                          <div
                            key={month.key}
                            className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                              repayment ? 'bg-blue-100 text-blue-900 font-semibold' : 'text-gray-400'
                            }`}
                          >
                            {repayment ? `₹${repayment.repayment_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : 'number'}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })()}

            {/* QH Year 5 */}
            {(() => {
              const yearNum = 5;
              const schedule = organizedSchedules.qardan_hasana[yearNum];
              const hasRepayments = schedule && schedule.payment_type === 'qardan_hasana' && schedule.repayments?.length > 0;
              return (
                <React.Fragment key="qh-5">
                  <div className="flex border-b border-gray-200 hover:bg-gray-50">
                    <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-white flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {!isViewOnly && schedule && !schedule.is_disbursed && (
                          <button
                            onClick={() => handleRemove('qardan_hasana', yearNum)}
                            className="text-red-500 hover:text-red-700"
                            title="Remove schedule"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        <span className="text-sm font-medium text-gray-900" data-year={yearNum}>
                          QH Year 5
                          {schedule?.is_disbursed && (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Disbursed</span>
                          )}
                        </span>
                      </div>
                      {!isViewOnly && schedule && !schedule.is_disbursed && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleConfirmDisbursement(schedule)}
                          className="ml-2 text-xs"
                        >
                          Confirm
                        </Button>
                      )}
                    </div>
                    {timelineMonths.map(month => {
                      const value = getCellValue(schedule, month, true);
                      const isDisbursement = schedule && 
                        schedule.disbursement_year === month.year && 
                        schedule.disbursement_month === month.month;
                      return (
                        <div
                          key={month.key}
                          onClick={() => !isViewOnly && !schedule?.is_disbursed && handleCellClick('qardan_hasana', yearNum, month, schedule)}
                          className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                            isDisbursement ? 'bg-blue-600 text-white font-semibold' :
                            schedule?.is_disbursed ? 'bg-gray-100 cursor-not-allowed' :
                            !isViewOnly ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300' : ''
                          }`}
                          title={schedule?.is_disbursed ? 'Disbursed - Cannot edit' : (!isViewOnly ? 'Click to add/edit payment' : '')}
                        >
                          {value ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : (!isViewOnly && !schedule?.is_disbursed ? 'Click' : '-')}
                        </div>
                      );
                    })}
                  </div>
                  {hasRepayments && (
                    <div className="flex border-b border-gray-200 hover:bg-gray-50">
                      <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-gray-50 flex items-center space-x-2">
                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span 
                          className="text-sm text-gray-600" 
                          data-year={yearNum}
                          dangerouslySetInnerHTML={{__html: 'Repayments (QH Year 5)'}}
                        />
                      </div>
                      {timelineMonths.map(month => {
                        const repayment = schedule.repayments?.find(
                          r => r.repayment_year === month.year && r.repayment_month === month.month
                        );
                        return (
                          <div
                            key={month.key}
                            className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                              repayment ? 'bg-blue-100 text-blue-900 font-semibold' : 'text-gray-400'
                            }`}
                          >
                            {repayment ? `₹${repayment.repayment_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : 'number'}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })()}

             {/* Enayat Rows */}
             {/* Enayat Year 1 */}
             {(() => {
               const yearNum = 1;
               const schedule = organizedSchedules.enayat[yearNum];
               return (
                 <div key="enayat-1" className="flex border-b border-gray-200 hover:bg-gray-50">
                   <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-white flex items-center justify-between">
                     <div className="flex items-center space-x-2">
                       {!isViewOnly && schedule && !schedule.is_disbursed && (
                         <button
                           onClick={() => handleRemove('enayat', yearNum)}
                           className="text-red-500 hover:text-red-700"
                           title="Remove schedule"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                           </svg>
                         </button>
                       )}
                       <span className="text-sm font-medium text-gray-900" data-year={yearNum} data-type="enayat">
                         Enayat Year 1
                         {schedule?.is_disbursed && (
                           <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Disbursed</span>
                         )}
                       </span>
                     </div>
                     {!isViewOnly && schedule && !schedule.is_disbursed && (
                       <Button
                         variant="primary"
                         size="sm"
                         onClick={() => handleConfirmDisbursement(schedule)}
                         className="ml-2 text-xs"
                       >
                         Confirm
                       </Button>
                     )}
                   </div>
                   {timelineMonths.map(month => {
                     const value = getCellValue(schedule, month);
                     const isDisbursement = schedule && 
                       schedule.disbursement_year === month.year && 
                       schedule.disbursement_month === month.month;
                     return (
                       <div
                         key={month.key}
                         onClick={() => !isViewOnly && !schedule?.is_disbursed && handleCellClick('enayat', yearNum, month, schedule)}
                         className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                           isDisbursement ? 'bg-blue-600 text-white font-semibold' :
                           schedule?.is_disbursed ? 'bg-gray-100 cursor-not-allowed' :
                           !isViewOnly ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300' : ''
                         }`}
                         title={schedule?.is_disbursed ? 'Disbursed - Cannot edit' : (!isViewOnly ? 'Click to add/edit payment' : '')}
                       >
                         {value ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : (!isViewOnly && !schedule?.is_disbursed ? 'Click' : '-')}
                       </div>
                     );
                   })}
                 </div>
               );
             })()}

             {/* Enayat Year 2 */}
             {(() => {
               const yearNum = 2;
               const schedule = organizedSchedules.enayat[yearNum];
               return (
                 <div key="enayat-2" className="flex border-b border-gray-200 hover:bg-gray-50">
                   <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-white flex items-center justify-between">
                     <div className="flex items-center space-x-2">
                       {!isViewOnly && schedule && !schedule.is_disbursed && (
                         <button
                           onClick={() => handleRemove('enayat', yearNum)}
                           className="text-red-500 hover:text-red-700"
                           title="Remove schedule"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                           </svg>
                         </button>
                       )}
                       <span className="text-sm font-medium text-gray-900" data-year={yearNum} data-type="enayat">
                         Enayat Year 2
                         {schedule?.is_disbursed && (
                           <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Disbursed</span>
                         )}
                       </span>
                     </div>
                     {!isViewOnly && schedule && !schedule.is_disbursed && (
                       <Button
                         variant="primary"
                         size="sm"
                         onClick={() => handleConfirmDisbursement(schedule)}
                         className="ml-2 text-xs"
                       >
                         Confirm
                       </Button>
                     )}
                   </div>
                   {timelineMonths.map(month => {
                     const value = getCellValue(schedule, month);
                     const isDisbursement = schedule && 
                       schedule.disbursement_year === month.year && 
                       schedule.disbursement_month === month.month;
                     return (
                       <div
                         key={month.key}
                         onClick={() => !isViewOnly && !schedule?.is_disbursed && handleCellClick('enayat', yearNum, month, schedule)}
                         className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                           isDisbursement ? 'bg-blue-600 text-white font-semibold' :
                           schedule?.is_disbursed ? 'bg-gray-100 cursor-not-allowed' :
                           !isViewOnly ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300' : ''
                         }`}
                         title={schedule?.is_disbursed ? 'Disbursed - Cannot edit' : (!isViewOnly ? 'Click to add/edit payment' : '')}
                       >
                         {value ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : (!isViewOnly && !schedule?.is_disbursed ? 'Click' : '-')}
                       </div>
                     );
                   })}
                 </div>
               );
             })()}

             {/* Enayat Year 3 */}
             {(() => {
               const yearNum = 3;
               const schedule = organizedSchedules.enayat[yearNum];
               return (
                 <div key="enayat-3" className="flex border-b border-gray-200 hover:bg-gray-50">
                   <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-white flex items-center justify-between">
                     <div className="flex items-center space-x-2">
                       {!isViewOnly && schedule && !schedule.is_disbursed && (
                         <button
                           onClick={() => handleRemove('enayat', yearNum)}
                           className="text-red-500 hover:text-red-700"
                           title="Remove schedule"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                           </svg>
                         </button>
                       )}
                       <span className="text-sm font-medium text-gray-900" data-year={yearNum} data-type="enayat">
                         Enayat Year 3
                         {schedule?.is_disbursed && (
                           <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Disbursed</span>
                         )}
                       </span>
                     </div>
                     {!isViewOnly && schedule && !schedule.is_disbursed && (
                       <Button
                         variant="primary"
                         size="sm"
                         onClick={() => handleConfirmDisbursement(schedule)}
                         className="ml-2 text-xs"
                       >
                         Confirm
                       </Button>
                     )}
                   </div>
                   {timelineMonths.map(month => {
                     const value = getCellValue(schedule, month);
                     const isDisbursement = schedule && 
                       schedule.disbursement_year === month.year && 
                       schedule.disbursement_month === month.month;
                     return (
                       <div
                         key={month.key}
                         onClick={() => !isViewOnly && !schedule?.is_disbursed && handleCellClick('enayat', yearNum, month, schedule)}
                         className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                           isDisbursement ? 'bg-blue-600 text-white font-semibold' :
                           schedule?.is_disbursed ? 'bg-gray-100 cursor-not-allowed' :
                           !isViewOnly ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300' : ''
                         }`}
                         title={schedule?.is_disbursed ? 'Disbursed - Cannot edit' : (!isViewOnly ? 'Click to add/edit payment' : '')}
                       >
                         {value ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : (!isViewOnly && !schedule?.is_disbursed ? 'Click' : '-')}
                       </div>
                     );
                   })}
                 </div>
               );
             })()}

             {/* Enayat Year 4 */}
             {(() => {
               const yearNum = 4;
               const schedule = organizedSchedules.enayat[yearNum];
               return (
                 <div key="enayat-4" className="flex border-b border-gray-200 hover:bg-gray-50">
                   <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-white flex items-center justify-between">
                     <div className="flex items-center space-x-2">
                       {!isViewOnly && schedule && !schedule.is_disbursed && (
                         <button
                           onClick={() => handleRemove('enayat', yearNum)}
                           className="text-red-500 hover:text-red-700"
                           title="Remove schedule"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                           </svg>
                         </button>
                       )}
                       <span className="text-sm font-medium text-gray-900" data-year={yearNum} data-type="enayat">
                         Enayat Year 4
                         {schedule?.is_disbursed && (
                           <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Disbursed</span>
                         )}
                       </span>
                     </div>
                     {!isViewOnly && schedule && !schedule.is_disbursed && (
                       <Button
                         variant="primary"
                         size="sm"
                         onClick={() => handleConfirmDisbursement(schedule)}
                         className="ml-2 text-xs"
                       >
                         Confirm
                       </Button>
                     )}
                   </div>
                   {timelineMonths.map(month => {
                     const value = getCellValue(schedule, month);
                     const isDisbursement = schedule && 
                       schedule.disbursement_year === month.year && 
                       schedule.disbursement_month === month.month;
                     return (
                       <div
                         key={month.key}
                         onClick={() => !isViewOnly && !schedule?.is_disbursed && handleCellClick('enayat', yearNum, month, schedule)}
                         className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                           isDisbursement ? 'bg-blue-600 text-white font-semibold' :
                           schedule?.is_disbursed ? 'bg-gray-100 cursor-not-allowed' :
                           !isViewOnly ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300' : ''
                         }`}
                         title={schedule?.is_disbursed ? 'Disbursed - Cannot edit' : (!isViewOnly ? 'Click to add/edit payment' : '')}
                       >
                         {value ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : (!isViewOnly && !schedule?.is_disbursed ? 'Click' : '-')}
                       </div>
                     );
                   })}
                 </div>
               );
             })()}

             {/* Enayat Year 5 */}
             {(() => {
               const yearNum = 5;
               const schedule = organizedSchedules.enayat[yearNum];
               return (
                 <div key="enayat-5" className="flex border-b border-gray-200 hover:bg-gray-50">
                   <div className="w-60 flex-shrink-0 border-r border-gray-300 p-2 bg-white flex items-center justify-between">
                     <div className="flex items-center space-x-2">
                       {!isViewOnly && schedule && !schedule.is_disbursed && (
                         <button
                           onClick={() => handleRemove('enayat', yearNum)}
                           className="text-red-500 hover:text-red-700"
                           title="Remove schedule"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                           </svg>
                         </button>
                       )}
                       <span className="text-sm font-medium text-gray-900" data-year={yearNum} data-type="enayat">
                         Enayat Year 5
                         {schedule?.is_disbursed && (
                           <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Disbursed</span>
                         )}
                       </span>
                     </div>
                     {!isViewOnly && schedule && !schedule.is_disbursed && (
                       <Button
                         variant="primary"
                         size="sm"
                         onClick={() => handleConfirmDisbursement(schedule)}
                         className="ml-2 text-xs"
                       >
                         Confirm
                       </Button>
                     )}
                   </div>
                   {timelineMonths.map(month => {
                     const value = getCellValue(schedule, month);
                     const isDisbursement = schedule && 
                       schedule.disbursement_year === month.year && 
                       schedule.disbursement_month === month.month;
                     return (
                       <div
                         key={month.key}
                         onClick={() => !isViewOnly && !schedule?.is_disbursed && handleCellClick('enayat', yearNum, month, schedule)}
                         className={`w-24 flex-shrink-0 border-r border-gray-200 p-2 text-center text-xs ${
                           isDisbursement ? 'bg-blue-600 text-white font-semibold' :
                           schedule?.is_disbursed ? 'bg-gray-100 cursor-not-allowed' :
                           !isViewOnly ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300' : ''
                         }`}
                         title={schedule?.is_disbursed ? 'Disbursed - Cannot edit' : (!isViewOnly ? 'Click to add/edit payment' : '')}
                       >
                         {value ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : (!isViewOnly && !schedule?.is_disbursed ? 'Click' : '-')}
                       </div>
                     );
                   })}
                 </div>
               );
             })()}
           </div>
         </div>
       </Card.Content>

      {/* Modal for adding/editing schedule */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setModalData(null);
            setSelectedCell(null);
          }}
          title="Configure Payment Schedule"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Type
              </label>
              <Select
                value={modalData.payment_type}
                onChange={(e) => {
                  const newType = e.target.value;
                  const existing = scheduleData?.schedules?.find(s => s.payment_type === newType && s.year_number === modalData.year_number);
                  if (!existing) {
                    setModalData({
                      ...modalData,
                      payment_type: newType,
                      repayment_months: newType === 'qardan_hasana' ? (modalData.repayment_months || 12) : null,
                      repayment_start_year: newType === 'qardan_hasana' ? (modalData.repayment_start_year || modalData.disbursement_year + 1) : null,
                      repayment_start_month: newType === 'qardan_hasana' ? (modalData.repayment_start_month || 1) : null
                    });
                  }
                }}
              >
                <Select.Option value="qardan_hasana">Qardan Hasana</Select.Option>
                <Select.Option value="enayat">Enayat</Select.Option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year Number
              </label>
              <Select
                value={modalData.year_number}
                onChange={(e) => {
                  const newYear = parseInt(e.target.value);
                  const existing = scheduleData?.schedules?.find(s => s.payment_type === modalData.payment_type && s.year_number === newYear);
                  if (!existing) {
                    setModalData({ ...modalData, year_number: newYear });
                  }
                }}
              >
                {[1, 2, 3, 4, 5].map(year => (
                  <Select.Option key={year} value={year}>Year {year}</Select.Option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Disbursement Year
                </label>
                <Select
                  value={modalData.disbursement_year}
                  onChange={(e) => setModalData({ ...modalData, disbursement_year: parseInt(e.target.value) })}
                >
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i - 2).map(year => (
                    <Select.Option key={year} value={year}>{year}</Select.Option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Disbursement Month
                </label>
                <Select
                  value={modalData.disbursement_month}
                  onChange={(e) => setModalData({ ...modalData, disbursement_month: parseInt(e.target.value) })}
                >
                  {[
                    { value: 1, label: 'January' },
                    { value: 2, label: 'February' },
                    { value: 3, label: 'March' },
                    { value: 4, label: 'April' },
                    { value: 5, label: 'May' },
                    { value: 6, label: 'June' },
                    { value: 7, label: 'July' },
                    { value: 8, label: 'August' },
                    { value: 9, label: 'September' },
                    { value: 10, label: 'October' },
                    { value: 11, label: 'November' },
                    { value: 12, label: 'December' }
                  ].map(month => (
                    <Select.Option key={month.value} value={month.value}>{month.label}</Select.Option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <Input
                type="number"
                value={modalData.disbursement_amount}
                onChange={(e) => setModalData({ ...modalData, disbursement_amount: e.target.value })}
                placeholder="Enter amount"
                min="0"
                step="0.01"
              />
            </div>

            {modalData.payment_type === 'qardan_hasana' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Repayment Months
                  </label>
                  <Input
                    type="number"
                    value={modalData.repayment_months}
                    onChange={(e) => setModalData({ ...modalData, repayment_months: parseInt(e.target.value) || 12 })}
                    placeholder="Number of months"
                    min="1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Repayment Start Year
                    </label>
                    <Select
                      value={modalData.repayment_start_year}
                      onChange={(e) => setModalData({ ...modalData, repayment_start_year: parseInt(e.target.value) })}
                    >
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i - 1).map(year => (
                        <Select.Option key={year} value={year}>{year}</Select.Option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Repayment Start Month
                    </label>
                    <Select
                      value={modalData.repayment_start_month}
                      onChange={(e) => setModalData({ ...modalData, repayment_start_month: parseInt(e.target.value) })}
                    >
                      {[
                        { value: 1, label: 'January' },
                        { value: 2, label: 'February' },
                        { value: 3, label: 'March' },
                        { value: 4, label: 'April' },
                        { value: 5, label: 'May' },
                        { value: 6, label: 'June' },
                        { value: 7, label: 'July' },
                        { value: 8, label: 'August' },
                        { value: 9, label: 'September' },
                        { value: 10, label: 'October' },
                        { value: 11, label: 'November' },
                        { value: 12, label: 'December' }
                      ].map(month => (
                        <Select.Option key={month.value} value={month.value}>{month.label}</Select.Option>
                      ))}
                    </Select>
                  </div>
                </div>

                 {modalData.disbursement_amount && modalData.repayment_months && (
                   <Alert severity="info">
                     Monthly repayment will be: ₹{(parseFloat(modalData.disbursement_amount) / modalData.repayment_months).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                   </Alert>
                 )}
              </>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setModalData(null);
                  setSelectedCell(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                loading={saveMutation.isLoading}
              >
                Apply
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteTarget(null);
        }}
        title="Remove Payment Schedule"
        size="sm"
      >
        <div className="space-y-4">
          <Alert severity="warning">
            Are you sure you want to remove this payment schedule? This action cannot be undone.
          </Alert>
        </div>
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              setShowDeleteConfirm(false);
              setDeleteTarget(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={confirmDelete}
            loading={saveMutation.isLoading}
          >
            Remove
          </Button>
        </div>
      </Modal>

      {/* Disbursement Confirmation Modal */}
      {showDisbursementModal && disbursementModalData && (
        <Modal
          isOpen={showDisbursementModal}
          onClose={() => {
            setShowDisbursementModal(false);
            setDisbursementModalData(null);
          }}
          title="Confirm Disbursement"
          size="md"
        >
          <div className="space-y-4">
            <Alert severity="info">
              <strong>Amount to be disbursed:</strong> ₹{disbursementModalData.schedule.disbursement_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </Alert>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Amount Disburse <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={disbursementModalData.disbursed_date}
                onChange={(e) => setDisbursementModalData({
                  ...disbursementModalData,
                  disbursed_date: e.target.value
                })}
                required
              />
            </div>

            {disbursementModalData.schedule.payment_type === 'qardan_hasana' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repayment Months <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  value={disbursementModalData.repayment_months}
                  onChange={(e) => setDisbursementModalData({
                    ...disbursementModalData,
                    repayment_months: parseInt(e.target.value) || 12
                  })}
                  placeholder="Number of months"
                  min="1"
                  required
                />
                {disbursementModalData.schedule.disbursement_amount && disbursementModalData.repayment_months && (
                  <p className="mt-2 text-sm text-gray-600">
                    Monthly repayment will be: ₹{(disbursementModalData.schedule.disbursement_amount / disbursementModalData.repayment_months).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            )}

            <Alert severity="warning">
              Once confirmed, this disbursement cannot be edited. The amount will be locked and repayments will be calculated based on the disbursement date.
            </Alert>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDisbursementModal(false);
                  setDisbursementModalData(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmDisbursementSave}
                loading={confirmDisbursementMutation.isLoading}
              >
                Confirm Disbursement
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
};

export default PaymentSchedule;

