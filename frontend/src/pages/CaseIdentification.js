import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../utils/permissionUtils';
import {
  Button,
  Card,
  Table,
  Alert,
  Badge,
  Input,
  Modal,
  Select,
  Pagination
} from '../components/ui';

const CaseIdentification = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Permission checks
  const { hasPermission: canCreate } = usePermission('case_identification', 'create');
  const { hasPermission: canApprove } = usePermission('case_identification', 'approve');

  // Listing state
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [eligibleInFilter, setEligibleInFilter] = useState('');

  // Create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [isFetchingFromApi, setIsFetchingFromApi] = useState(false);
  const [apiError, setApiError] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewRecord, setReviewRecord] = useState(null);
  const [reviewAction, setReviewAction] = useState(''); // 'eligible' or 'ineligible'
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

  // Form
  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm();
  const watchedItsNumber = watch('its_number');
  const [previousItsNumber, setPreviousItsNumber] = useState('');

  // ─── Data Queries ───────────────────────────────────────────────────────

  // Fetch case identifications list
  const { data: listData, isLoading, refetch } = useQuery(
    ['caseIdentifications', page, searchTerm, statusFilter, eligibleInFilter, limit],
    () => axios.get('/api/case-identifications', {
      params: {
        page,
        limit,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(eligibleInFilter && { eligible_in: eligibleInFilter }),
      }
    }).then(res => res.data),
    { keepPreviousData: true }
  );

  // Fetch case types for the Eligible In dropdown
  const { data: caseTypes } = useQuery(
    'caseTypes',
    () => axios.get('/api/case-types').then(res => res.data),
    { select: (data) => data.caseTypes || [] }
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, eligibleInFilter]);

  // ─── ITS Auto-Fetch ─────────────────────────────────────────────────────

  useEffect(() => {
    if (watchedItsNumber && watchedItsNumber !== previousItsNumber && watchedItsNumber.length >= 3) {
      const timer = setTimeout(() => {
        fetchFromApi(watchedItsNumber);
      }, 500);
      setPreviousItsNumber(watchedItsNumber);
      return () => clearTimeout(timer);
    }
  }, [watchedItsNumber, previousItsNumber]);

  const handleItsKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const itsNumber = e.target.value.trim();
      if (itsNumber && itsNumber.length >= 3) {
        fetchFromApi(itsNumber);
      }
    }
  };

  const fetchFromApi = async (itsNumber) => {
    if (!itsNumber || itsNumber.trim() === '') return;

    setIsFetchingFromApi(true);
    setApiError('');
    setDuplicateWarning(null);

    try {
      // Check for duplicates first
      const checkRes = await axios.get(`/api/case-identifications/check-its/${itsNumber}`);
      if (checkRes.data.exists) {
        setDuplicateWarning(checkRes.data.message);
      }

      // Fetch data from ITS API
      const response = await axios.get(`/api/applicants/fetch-from-api/${itsNumber}`);
      const apiData = response.data.data;

      if (apiData.full_name) setValue('full_name', apiData.full_name);
      if (apiData.age) setValue('age', apiData.age);
      if (apiData.gender) {
        // Map to display-friendly value
        const g = apiData.gender;
        if (g === 'male' || g === 'Male' || g === 'M') setValue('gender', 'Male');
        else if (g === 'female' || g === 'Female' || g === 'F') setValue('gender', 'Female');
        else setValue('gender', apiData.gender);
      }
      if (apiData.phone) setValue('phone', apiData.phone);
      if (apiData.email) setValue('email', apiData.email);
      if (apiData.address) setValue('address', apiData.address);
      if (apiData.jamiat_name) setValue('jamiat', apiData.jamiat_name);
      if (apiData.jamaat_name) setValue('jamaat', apiData.jamaat_name);
      if (apiData.photo) {
        setValue('photo', apiData.photo);
        setPhotoPreview(apiData.photo);
      } else {
        setValue('photo', null);
        setPhotoPreview(null);
      }

      setCreateSuccess('Data fetched successfully from API!');
      setCreateError('');
    } catch (error) {
      setApiError(error.response?.data?.error || 'Failed to fetch data from external API');
    } finally {
      setIsFetchingFromApi(false);
    }
  };

  // ─── Create Mutation ────────────────────────────────────────────────────

  const createMutation = useMutation(
    (data) => axios.post('/api/case-identifications', data),
    {
      onSuccess: () => {
        setCreateSuccess('Case identification created successfully!');
        setCreateError('');
        reset();
        setPhotoPreview(null);
        setDuplicateWarning(null);
        setPreviousItsNumber('');
        setTimeout(() => {
          setCreateModalOpen(false);
          setCreateSuccess('');
          queryClient.invalidateQueries('caseIdentifications');
        }, 1500);
      },
      onError: (error) => {
        setCreateError(error.response?.data?.error || 'Failed to create case identification');
        setCreateSuccess('');
      }
    }
  );

  // ─── Review Mutation ────────────────────────────────────────────────────

  const reviewMutation = useMutation(
    ({ id, status, review_remarks }) =>
      axios.put(`/api/case-identifications/${id}/review`, { status, review_remarks }),
    {
      onSuccess: (response) => {
        const data = response.data;
        setReviewSuccess(data.message);
        setReviewError('');
        queryClient.invalidateQueries('caseIdentifications');
        setTimeout(() => {
          setReviewModalOpen(false);
          setReviewRecord(null);
          setReviewRemarks('');
          setReviewSuccess('');
          // Navigate to case if created
          if (data.case_id) {
            navigate(`/cases/${data.case_id}`);
          }
        }, 2000);
      },
      onError: (error) => {
        setReviewError(error.response?.data?.error || 'Failed to review case identification');
        setReviewSuccess('');
      }
    }
  );

  // ─── Handlers ───────────────────────────────────────────────────────────

  const openCreateModal = () => {
    reset();
    setCreateError('');
    setCreateSuccess('');
    setApiError('');
    setPhotoPreview(null);
    setDuplicateWarning(null);
    setPreviousItsNumber('');
    setCreateModalOpen(true);
  };

  const onSubmit = async (data) => {
    if (createMutation.isLoading) return;

    // Double-check duplicate before submitting
    try {
      const checkRes = await axios.get(`/api/case-identifications/check-its/${data.its_number}`);
      if (checkRes.data.exists) {
        setCreateError('Case already registered for this ITS number');
        return;
      }
    } catch (e) {
      // Continue if check fails
    }

    setCreateError('');
    setCreateSuccess('');

    createMutation.mutate({
      its_number: data.its_number,
      full_name: data.full_name,
      age: data.age ? parseInt(data.age) : null,
      gender: data.gender,
      phone: data.phone,
      email: data.email,
      photo: data.photo || null,
      address: data.address,
      jamiat: data.jamiat,
      jamaat: data.jamaat,
      eligible_in: parseInt(data.eligible_in),
      total_family_members: parseInt(data.total_family_members),
      earning_family_members: parseInt(data.earning_family_members),
      individual_income: parseInt(data.individual_income),
      family_income: parseInt(data.family_income),
      remarks: data.remarks || null
    });
  };

  const openReviewModal = (record, action) => {
    setReviewRecord(record);
    setReviewAction(action);
    setReviewRemarks('');
    setReviewError('');
    setReviewSuccess('');
    setReviewModalOpen(true);
  };

  const handleConfirmReview = () => {
    if (!reviewRecord || reviewMutation.isLoading) return;
    reviewMutation.mutate({
      id: reviewRecord.id,
      status: reviewAction,
      review_remarks: reviewRemarks || null
    });
  };

  // ─── Status Badge Helper ────────────────────────────────────────────────

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'eligible':
        return <Badge variant="success">Eligible</Badge>;
      case 'ineligible':
        return <Badge variant="danger">Ineligible</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  const records = listData?.records || [];
  const pagination = listData?.pagination || {};

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Case Identification</h1>
          <p className="text-sm text-gray-500 mt-1">Identify and assess cases for eligibility</p>
        </div>
        {canCreate && (
          <Button onClick={openCreateModal}>
            + New Case Identification
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search by ITS or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="eligible">Eligible</option>
                <option value="ineligible">Ineligible</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Eligible In</label>
              <select
                value={eligibleInFilter}
                onChange={(e) => setEligibleInFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="">All Types</option>
                {caseTypes?.map(ct => (
                  <option key={ct.id} value={ct.id}>{ct.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setEligibleInFilter('');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ITS</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eligible In</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Family Members</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Earning Members</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Individual Income</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Family Income</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-gray-500">No case identifications found</td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {record.its_number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {record.full_name || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {record.case_type_name || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {record.total_family_members}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {record.earning_family_members}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {record.individual_income?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {record.family_income?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(record.status)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(record.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        {/* Eligible/Ineligible buttons - only for pending + approve permission */}
                        {record.status === 'pending' && canApprove && (
                          <>
                            <button
                              onClick={() => openReviewModal(record, 'eligible')}
                              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500"
                            >
                              Eligible
                            </button>
                            <button
                              onClick={() => openReviewModal(record, 'ineligible')}
                              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500"
                            >
                              Ineligible
                            </button>
                          </>
                        )}
                        {/* Link to case for eligible records */}
                        {record.status === 'eligible' && record.case_id && (
                          <button
                            onClick={() => navigate(`/cases/${record.case_id}`)}
                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none"
                          >
                            View Case
                          </button>
                        )}
                        {record.status === 'ineligible' && (
                          <span className="text-xs text-gray-400 italic">Ineligible</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} results
            </div>
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {/* ─── Create Modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => { setCreateModalOpen(false); reset(); setPhotoPreview(null); setDuplicateWarning(null); setPreviousItsNumber(''); }}
        title="New Case Identification"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-6 p-1">
            {createError && <Alert variant="error">{createError}</Alert>}
            {createSuccess && <Alert variant="success">{createSuccess}</Alert>}
            {apiError && <Alert variant="warning">{apiError}</Alert>}
            {duplicateWarning && (
              <Alert variant="error">
                <strong>Case already registered!</strong> {duplicateWarning}
              </Alert>
            )}

            {/* ── Personal Information ── */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Personal Information</h3>
              <p className="text-sm text-gray-500 mb-4">Basic personal details of the applicant</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ITS Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('its_number', {
                      required: 'ITS number is required',
                      pattern: { value: /^[0-9]{8}$/, message: 'Must be exactly 8 digits' }
                    })}
                    onKeyDown={handleItsKeyDown}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter 8-digit ITS number"
                  />
                  {errors.its_number && (
                    <p className="mt-1 text-sm text-red-600">{errors.its_number.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    Data will be automatically fetched as you type (minimum 3 characters) or press Enter
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    {...register('full_name')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50"
                    readOnly
                  />
                </div>
              </div>

              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const its = watch('its_number');
                    if (its) fetchFromApi(its);
                  }}
                  disabled={isFetchingFromApi}
                >
                  {isFetchingFromApi ? 'Fetching...' : 'Refresh Details'}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                  <input
                    type="text"
                    {...register('age')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <input
                    type="text"
                    {...register('gender')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50"
                    readOnly
                  />
                </div>
              </div>

              {/* Photo preview */}
              {photoPreview && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Photo (from API)</label>
                  <img
                    src={photoPreview}
                    alt="Applicant"
                    className="w-24 h-24 rounded-lg object-cover border border-gray-200"
                  />
                </div>
              )}
            </div>

            {/* Hidden photo field */}
            <input type="hidden" {...register('photo')} />

            {/* ── Contact Information ── */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Contact Information</h3>
              <p className="text-sm text-gray-500 mb-4">Phone and email contact details</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    {...register('phone')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="text"
                    {...register('email')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50"
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* ── Address Information ── */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Address Information</h3>
              <p className="text-sm text-gray-500 mb-4">Complete address details</p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  {...register('address')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50"
                  readOnly
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jamiat</label>
                  <input
                    type="text"
                    {...register('jamiat')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jamaat</label>
                  <input
                    type="text"
                    {...register('jamaat')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50"
                    readOnly
                  />
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* ── Assessment Questions ── */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Assessment</h3>
              <p className="text-sm text-gray-500 mb-4">Case eligibility assessment details</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Eligible In */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Eligible In <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('eligible_in', { required: 'Eligible In is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Select case type...</option>
                    {caseTypes?.map(ct => (
                      <option key={ct.id} value={ct.id}>{ct.name}</option>
                    ))}
                  </select>
                  {errors.eligible_in && (
                    <p className="mt-1 text-sm text-red-600">{errors.eligible_in.message}</p>
                  )}
                </div>

                {/* Total Family Members */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Family Members <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    {...register('total_family_members', {
                      required: 'Total family members is required',
                      min: { value: 0, message: 'Cannot be negative' },
                      max: { value: 25, message: 'Cannot exceed 25' }
                    })}
                    min="0"
                    max="25"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter number (max 25)"
                  />
                  {errors.total_family_members && (
                    <p className="mt-1 text-sm text-red-600">{errors.total_family_members.message}</p>
                  )}
                </div>

                {/* Earning Family Members */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Earning Family Members <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    {...register('earning_family_members', {
                      required: 'Earning family members is required',
                      min: { value: 0, message: 'Cannot be negative' },
                      max: { value: 20, message: 'Cannot exceed 20' }
                    })}
                    min="0"
                    max="20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter number (max 20)"
                  />
                  {errors.earning_family_members && (
                    <p className="mt-1 text-sm text-red-600">{errors.earning_family_members.message}</p>
                  )}
                </div>

                {/* Individual Income */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Individual Income <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    {...register('individual_income', {
                      required: 'Individual income is required',
                      min: { value: 0, message: 'Cannot be negative' },
                      max: { value: 9999999, message: 'Cannot exceed 7 digits' }
                    })}
                    min="0"
                    max="9999999"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter amount (max 9999999)"
                  />
                  {errors.individual_income && (
                    <p className="mt-1 text-sm text-red-600">{errors.individual_income.message}</p>
                  )}
                </div>

                {/* Family Income */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Family Income <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    {...register('family_income', {
                      required: 'Family income is required',
                      min: { value: 0, message: 'Cannot be negative' },
                      max: { value: 9999999, message: 'Cannot exceed 7 digits' }
                    })}
                    min="0"
                    max="9999999"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter amount (max 9999999)"
                  />
                  {errors.family_income && (
                    <p className="mt-1 text-sm text-red-600">{errors.family_income.message}</p>
                  )}
                </div>
              </div>

              {/* Remarks */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (Optional)</label>
                <textarea
                  {...register('remarks')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Enter any additional remarks..."
                />
              </div>
            </div>
          </div>

          {/* Modal footer */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setCreateModalOpen(false); reset(); setPhotoPreview(null); setDuplicateWarning(null); setPreviousItsNumber(''); }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isLoading || !!duplicateWarning}
            >
              {createMutation.isLoading ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Review Confirmation Modal ──────────────────────────────────── */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => { setReviewModalOpen(false); setReviewRecord(null); setReviewRemarks(''); }}
        title={reviewAction === 'eligible' ? 'Mark as Eligible' : 'Mark as Ineligible'}
        size="md"
      >
        <div className="space-y-4">
          {reviewError && <Alert variant="error">{reviewError}</Alert>}
          {reviewSuccess && <Alert variant="success">{reviewSuccess}</Alert>}

          {reviewRecord && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium text-gray-600">ITS:</span> {reviewRecord.its_number}</div>
                <div><span className="font-medium text-gray-600">Name:</span> {reviewRecord.full_name || '-'}</div>
                <div><span className="font-medium text-gray-600">Eligible In:</span> {reviewRecord.case_type_name || '-'}</div>
                <div><span className="font-medium text-gray-600">Family Members:</span> {reviewRecord.total_family_members}</div>
              </div>
            </div>
          )}

          {reviewAction === 'eligible' ? (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Confirm Eligibility:</strong> This will mark the case as eligible and automatically create a new case in the system.
              </p>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Confirm Ineligibility:</strong> This will mark the case as ineligible. This action cannot be undone.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Review Remarks {reviewAction === 'ineligible' ? '' : '(Optional)'}
            </label>
            <textarea
              value={reviewRemarks}
              onChange={(e) => setReviewRemarks(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder={reviewAction === 'ineligible' ? 'Reason for ineligibility...' : 'Any additional remarks...'}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => { setReviewModalOpen(false); setReviewRecord(null); setReviewRemarks(''); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmReview}
              disabled={reviewMutation.isLoading}
              className={reviewAction === 'eligible' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {reviewMutation.isLoading
                ? 'Processing...'
                : reviewAction === 'eligible'
                  ? 'Confirm Eligible'
                  : 'Confirm Ineligible'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CaseIdentification;
