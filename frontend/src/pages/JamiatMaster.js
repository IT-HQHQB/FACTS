import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Card, Alert, Table, Select, Modal, Badge, Switch, Pagination } from '../components/ui';

const JamiatMaster = () => {
  const { token } = useAuth();
  const [jamiat, setJamiat] = useState([]);
  const [jamaat, setJamaat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Sorting states
  const [jamiatSortField, setJamiatSortField] = useState(null);
  const [jamiatSortDirection, setJamiatSortDirection] = useState('asc');
  const [jamaatSortField, setJamaatSortField] = useState(null);
  const [jamaatSortDirection, setJamaatSortDirection] = useState('asc');
  
  // Pagination states
  const [jamiatCurrentPage, setJamiatCurrentPage] = useState(1);
  const [jamiatRowsPerPage, setJamiatRowsPerPage] = useState(10);
  const [jamaatCurrentPage, setJamaatCurrentPage] = useState(1);
  const [jamaatRowsPerPage, setJamaatRowsPerPage] = useState(10);
  
  // Modal states
  const [jamiatModalOpen, setJamiatModalOpen] = useState(false);
  const [jamaatModalOpen, setJamaatModalOpen] = useState(false);
  const [selectedJamiat, setSelectedJamiat] = useState(null);
  const [selectedJamaat, setSelectedJamaat] = useState(null);
  
  // Form states
  const [jamiatForm, setJamiatForm] = useState({
    name: '',
    jamiat_id: '',
    is_active: true
  });
  const [jamaatForm, setJamaatForm] = useState({
    jamiat_id: '',
    name: '',
    jamaat_id: '',
    is_active: true
  });
  
  const [jamiatLoading, setJamiatLoading] = useState(false);
  const [jamaatLoading, setJamaatLoading] = useState(false);
  const [jamiatError, setJamiatError] = useState('');
  const [jamaatError, setJamaatError] = useState('');
  
  // Import/Export states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Update from API states
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');

  // Fetch jamiat data
  const fetchJamiat = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/jamiat', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch jamiat');
      }
      
      const data = await response.json();
      setJamiat(data.jamiat || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch jamaat data
  const fetchJamaat = async () => {
    try {
      const response = await fetch('/api/jamaat', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch jamaat');
      }
      
      const data = await response.json();
      setJamaat(data.jamaat || []);
    } catch (err) {
      console.error('Error fetching jamaat:', err);
    }
  };

  // Create jamiat
  const createJamiat = async () => {
    try {
      setJamiatLoading(true);
      setJamiatError('');
      
      const response = await fetch('/api/jamiat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jamiatForm)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create jamiat');
      }
      
      setSuccess('Jamiat created successfully');
      setJamiatModalOpen(false);
      fetchJamiat();
    } catch (err) {
      setJamiatError(err.message);
    } finally {
      setJamiatLoading(false);
    }
  };

  // Update jamiat
  const updateJamiat = async () => {
    try {
      setJamiatLoading(true);
      setJamiatError('');
      
      const response = await fetch(`/api/jamiat/${selectedJamiat.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jamiatForm)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update jamiat');
      }
      
      setSuccess('Jamiat updated successfully');
      setJamiatModalOpen(false);
      fetchJamiat();
    } catch (err) {
      setJamiatError(err.message);
    } finally {
      setJamiatLoading(false);
    }
  };

  // Create jamaat
  const createJamaat = async () => {
    try {
      setJamaatLoading(true);
      setJamaatError('');
      
      const response = await fetch('/api/jamaat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jamaatForm)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create jamaat');
      }
      
      setSuccess('Jamaat created successfully');
      setJamaatModalOpen(false);
      fetchJamaat();
    } catch (err) {
      setJamaatError(err.message);
    } finally {
      setJamaatLoading(false);
    }
  };

  // Update jamaat
  const updateJamaat = async () => {
    try {
      setJamaatLoading(true);
      setJamaatError('');
      
      const response = await fetch(`/api/jamaat/${selectedJamaat.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jamaatForm)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update jamaat');
      }
      
      setSuccess('Jamaat updated successfully');
      setJamaatModalOpen(false);
      fetchJamaat();
    } catch (err) {
      setJamaatError(err.message);
    } finally {
      setJamaatLoading(false);
    }
  };

  // Delete jamiat
  const deleteJamiat = async (jamiatId) => {
    if (!window.confirm('Are you sure you want to delete this jamiat? This will also delete all associated jamaats.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/jamiat/${jamiatId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete jamiat');
      }
      
      setSuccess('Jamiat deleted successfully');
      fetchJamiat();
      fetchJamaat();
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete jamaat
  const deleteJamaat = async (jamaatId) => {
    if (!window.confirm('Are you sure you want to delete this jamaat?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/jamaat/${jamaatId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete jamaat');
      }
      
      setSuccess('Jamaat deleted successfully');
      fetchJamaat();
    } catch (err) {
      setError(err.message);
    }
  };

  // Open jamiat modal
  const openJamiatModal = (jamiat = null) => {
    setSelectedJamiat(jamiat);
    if (jamiat) {
      setJamiatForm({
        name: jamiat.name || '',
        jamiat_id: jamiat.jamiat_id || '',
        is_active: jamiat.is_active
      });
    } else {
      setJamiatForm({
        name: '',
        jamiat_id: '',
        is_active: true
      });
    }
    setJamiatError('');
    setJamiatModalOpen(true);
  };

  // Open jamaat modal
  const openJamaatModal = (jamaat = null) => {
    setSelectedJamaat(jamaat);
    if (jamaat) {
      setJamaatForm({
        jamiat_id: jamaat.jamiat_id || '',
        name: jamaat.name || '',
        jamaat_id: jamaat.jamaat_id || '',
        is_active: jamaat.is_active
      });
    } else {
      setJamaatForm({
        jamiat_id: '',
        name: '',
        jamaat_id: '',
        is_active: true
      });
    }
    setJamaatError('');
    setJamaatModalOpen(true);
  };

  // Get jamiat name by ID
  const getJamiatName = (jamiatId) => {
    const jamiatItem = jamiat.find(j => j.id === jamiatId);
    return jamiatItem ? jamiatItem.name : 'Unknown';
  };

  // Get jamaats by jamiat ID
  const getJamaatsByJamiat = (jamiatId) => {
    return jamaat.filter(j => j.jamiat_id === jamiatId);
  };

  // Sorting functions
  const handleJamiatSort = (field) => {
    if (jamiatSortField === field) {
      setJamiatSortDirection(jamiatSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setJamiatSortField(field);
      setJamiatSortDirection('asc');
    }
  };

  const handleJamaatSort = (field) => {
    if (jamaatSortField === field) {
      setJamaatSortDirection(jamaatSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setJamaatSortField(field);
      setJamaatSortDirection('asc');
    }
  };

  // Sort jamiat data
  const getSortedJamiat = () => {
    let sorted = jamiat;
    
    if (jamiatSortField) {
      sorted = [...jamiat].sort((a, b) => {
        let aValue, bValue;

        switch (jamiatSortField) {
          case 'name':
            aValue = a.name?.toLowerCase() || '';
            bValue = b.name?.toLowerCase() || '';
            break;
          case 'jamiat_id':
            aValue = a.jamiat_id?.toLowerCase() || '';
            bValue = b.jamiat_id?.toLowerCase() || '';
            break;
          case 'status':
            aValue = a.is_active ? 1 : 0;
            bValue = b.is_active ? 1 : 0;
            break;
          case 'jamaats_count':
            aValue = getJamaatsByJamiat(a.id).length;
            bValue = getJamaatsByJamiat(b.id).length;
            break;
          case 'created_at':
            aValue = new Date(a.created_at);
            bValue = new Date(b.created_at);
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return jamiatSortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return jamiatSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return sorted;
  };

  // Get paginated jamiat data
  const getPaginatedJamiat = () => {
    const sorted = getSortedJamiat();
    const startIndex = (jamiatCurrentPage - 1) * jamiatRowsPerPage;
    const endIndex = startIndex + jamiatRowsPerPage;
    return sorted.slice(startIndex, endIndex);
  };

  // Calculate total pages for jamiat
  const getJamiatTotalPages = () => {
    return Math.ceil(getSortedJamiat().length / jamiatRowsPerPage);
  };

  // Sort jamaat data
  const getSortedJamaat = () => {
    let sorted = jamaat;
    
    if (jamaatSortField) {
      sorted = [...jamaat].sort((a, b) => {
        let aValue, bValue;

        switch (jamaatSortField) {
          case 'name':
            aValue = a.name?.toLowerCase() || '';
            bValue = b.name?.toLowerCase() || '';
            break;
          case 'jamaat_id':
            aValue = a.jamaat_id?.toLowerCase() || '';
            bValue = b.jamaat_id?.toLowerCase() || '';
            break;
          case 'jamiat':
            aValue = getJamiatName(a.jamiat_id)?.toLowerCase() || '';
            bValue = getJamiatName(b.jamiat_id)?.toLowerCase() || '';
            break;
          case 'status':
            aValue = a.is_active ? 1 : 0;
            bValue = b.is_active ? 1 : 0;
            break;
          case 'created_at':
            aValue = new Date(a.created_at);
            bValue = new Date(b.created_at);
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return jamaatSortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return jamaatSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return sorted;
  };

  // Get paginated jamaat data
  const getPaginatedJamaat = () => {
    const sorted = getSortedJamaat();
    const startIndex = (jamaatCurrentPage - 1) * jamaatRowsPerPage;
    const endIndex = startIndex + jamaatRowsPerPage;
    return sorted.slice(startIndex, endIndex);
  };

  // Calculate total pages for jamaat
  const getJamaatTotalPages = () => {
    return Math.ceil(getSortedJamaat().length / jamaatRowsPerPage);
  };

  // Download sample template
  const downloadTemplate = async () => {
    try {
      
      const response = await fetch('/api/jamiat/template/download', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Template download error:', errorText);
        throw new Error(`Failed to download template: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jamiat_jamaat_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSuccess('Template downloaded successfully');
    } catch (err) {
      console.error('Template download error:', err);
      setError(err.message);
    }
  };

  // Export to Excel
  const exportToExcel = async () => {
    try {
      
      const response = await fetch('/api/jamiat/export/excel', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Export error:', errorText);
        throw new Error(`Failed to export data: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jamiat_jamaat_export.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSuccess('Data exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      setError(err.message);
    }
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.type === 'application/vnd.ms-excel') {
        setSelectedFile(file);
        setImportError('');
      } else {
        setImportError('Please select a valid Excel file (.xlsx or .xls)');
        setSelectedFile(null);
      }
    }
  };

  // Import Excel file
  const importExcel = async () => {
    if (!selectedFile) {
      setImportError('Please select a file to import');
      return;
    }
    
    try {
      setImportLoading(true);
      setImportError('');
      setImportSuccess('');
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await fetch('/api/jamiat/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import data');
      }
      
      const result = await response.json();
      setImportSuccess(`Import completed successfully! ${result.importedJamiat} jamiat and ${result.importedJamaat} jamaat imported.`);
      setImportModalOpen(false);
      setSelectedFile(null);
      fetchJamiat();
      fetchJamaat();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImportLoading(false);
    }
  };

  // Update from external API
  const updateFromAPI = async () => {
    try {
      setUpdateLoading(true);
      setUpdateError('');
      setUpdateSuccess('');
      
      // Fetch data from external API
      const response = await fetch('http://13.127.158.101:3000/test/jamiat-jamaat');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data from API: ${response.status} ${response.statusText}`);
      }
      
      const apiData = await response.json();
      
      if (!apiData.list || !Array.isArray(apiData.list)) {
        throw new Error('Invalid API response format');
      }
      
      let jamiatCreated = 0;
      let jamiatUpdated = 0;
      let jamaatCreated = 0;
      let jamaatUpdated = 0;
      let errors = [];
      
      // Process jamiats - extract unique jamiats from the list
      const jamiatMap = new Map();
      apiData.list.forEach(item => {
        const jamiatId = item.Jamiaat_ID;
        const jamiatName = item.Jamiaat;
        
        if (jamiatId && jamiatName && !jamiatMap.has(jamiatId)) {
          jamiatMap.set(jamiatId, {
            jamiat_id: String(jamiatId),
            name: jamiatName,
            is_active: true
          });
        }
      });
      
      // Process each jamiat
      for (const [apiJamiatId, jamiatData] of jamiatMap) {
        try {
          // Check if jamiat exists by jamiat_id
          const existingJamiat = jamiat.find(j => j.jamiat_id === jamiatData.jamiat_id);
          
          if (existingJamiat) {
            // Check if name has changed
            if (existingJamiat.name !== jamiatData.name) {
              // Update jamiat
              const updateResponse = await fetch(`/api/jamiat/${existingJamiat.id}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  name: jamiatData.name,
                  jamiat_id: jamiatData.jamiat_id,
                  is_active: jamiatData.is_active
                })
              });
              
              if (updateResponse.ok) {
                jamiatUpdated++;
              } else {
                const errorData = await updateResponse.json();
                errors.push(`Failed to update jamiat ${jamiatData.name}: ${errorData.error || 'Unknown error'}`);
              }
            }
          } else {
            // Create new jamiat
            const createResponse = await fetch('/api/jamiat', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(jamiatData)
            });
            
            if (createResponse.ok) {
              jamiatCreated++;
            } else {
              const errorData = await createResponse.json();
              errors.push(`Failed to create jamiat ${jamiatData.name}: ${errorData.error || 'Unknown error'}`);
            }
          }
        } catch (err) {
          errors.push(`Error processing jamiat ${jamiatData.name}: ${err.message}`);
        }
      }
      
      // Refresh jamiat data to get updated IDs
      await fetchJamiat();
      
      // Fetch fresh jamiat data for jamaat processing
      const jamiatResponse = await fetch('/api/jamiat', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const jamiatData = await jamiatResponse.json();
      const freshJamiat = jamiatData.jamiat || [];
      
      // Fetch fresh jamaat data for comparison
      const jamaatResponse = await fetch('/api/jamaat', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const jamaatData = await jamaatResponse.json();
      const freshJamaat = jamaatData.jamaat || [];
      
      // Process jamaats
      for (const item of apiData.list) {
        try {
          const apiJamiatId = item.Jamiaat_ID;
          const apiJamaatId = item.Jamaat_ID;
          const jamaatName = item.Jamaat;
          
          if (!apiJamiatId || !apiJamaatId || !jamaatName) {
            continue; // Skip invalid entries
          }
          
          // Find the internal jamiat ID
          const internalJamiat = freshJamiat.find(j => j.jamiat_id === String(apiJamiatId));
          
          if (!internalJamiat) {
            errors.push(`Jamiat with ID ${apiJamiatId} not found for jamaat ${jamaatName}`);
            continue;
          }
          
          // Check if jamaat exists by jamaat_id and jamiat_id
          const existingJamaat = freshJamaat.find(j => 
            j.jamaat_id === String(apiJamaatId) && j.jamiat_id === internalJamiat.id
          );
          
          if (existingJamaat) {
            // Check if name has changed
            if (existingJamaat.name !== jamaatName) {
              // Update jamaat
              const updateResponse = await fetch(`/api/jamaat/${existingJamaat.id}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  jamiat_id: internalJamiat.id,
                  jamaat_id: String(apiJamaatId),
                  name: jamaatName,
                  is_active: true
                })
              });
              
              if (updateResponse.ok) {
                jamaatUpdated++;
              } else {
                const errorData = await updateResponse.json();
                errors.push(`Failed to update jamaat ${jamaatName}: ${errorData.error || 'Unknown error'}`);
              }
            }
          } else {
            // Create new jamaat
            const createResponse = await fetch('/api/jamaat', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                jamiat_id: internalJamiat.id,
                jamaat_id: String(apiJamaatId),
                name: jamaatName,
                is_active: true
              })
            });
            
            if (createResponse.ok) {
              jamaatCreated++;
            } else {
              const errorData = await createResponse.json();
              errors.push(`Failed to create jamaat ${jamaatName}: ${errorData.error || 'Unknown error'}`);
            }
          }
        } catch (err) {
          errors.push(`Error processing jamaat ${item.Jamaat || 'unknown'}: ${err.message}`);
        }
      }
      
      // Refresh data
      await fetchJamiat();
      await fetchJamaat();
      
      // Show results
      const resultParts = [];
      if (jamiatCreated > 0) resultParts.push(`${jamiatCreated} jamiat(s) created`);
      if (jamiatUpdated > 0) resultParts.push(`${jamiatUpdated} jamiat(s) updated`);
      if (jamaatCreated > 0) resultParts.push(`${jamaatCreated} jamaat(s) created`);
      if (jamaatUpdated > 0) resultParts.push(`${jamaatUpdated} jamaat(s) updated`);
      
      if (resultParts.length > 0) {
        setUpdateSuccess(`Update completed! ${resultParts.join(', ')}.`);
      } else {
        setUpdateSuccess('No changes detected. All data is up to date.');
      }
      
      if (errors.length > 0) {
        console.error('Update errors:', errors);
        setUpdateError(`Some errors occurred: ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? '...' : ''}`);
      }
      
    } catch (err) {
      console.error('Update from API error:', err);
      setUpdateError(err.message || 'Failed to update data from API');
    } finally {
      setUpdateLoading(false);
    }
  };

  useEffect(() => {
    fetchJamiat();
    fetchJamaat();
  }, []);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Reset pagination when data changes
  useEffect(() => {
    const sortedJamiat = getSortedJamiat();
    const jamiatTotalPages = Math.ceil(sortedJamiat.length / jamiatRowsPerPage);
    if (jamiatCurrentPage > jamiatTotalPages && jamiatTotalPages > 0) {
      setJamiatCurrentPage(1);
    }
  }, [jamiat.length, jamiatRowsPerPage]);

  useEffect(() => {
    const sortedJamaat = getSortedJamaat();
    const jamaatTotalPages = Math.ceil(sortedJamaat.length / jamaatRowsPerPage);
    if (jamaatCurrentPage > jamaatTotalPages && jamaatTotalPages > 0) {
      setJamaatCurrentPage(1);
    }
  }, [jamaat.length, jamaatRowsPerPage]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Jamiat Master</h1>
            <p className="text-gray-600">Manage Jamiat and Jamaat organizations</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download Template</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setImportModalOpen(true)}
              className="flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <span>Import Excel</span>
            </Button>
            <Button
              variant="primary"
              onClick={exportToExcel}
              className="flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M7 7h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z" />
              </svg>
              <span>Export Excel</span>
            </Button>
            <Button
              variant="primary"
              onClick={updateFromAPI}
              loading={updateLoading}
              className="flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Update</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      {updateError && (
        <Alert severity="error" onClose={() => setUpdateError('')}>
          {updateError}
        </Alert>
      )}
      {updateSuccess && (
        <Alert severity="success" onClose={() => setUpdateSuccess('')}>
          {updateSuccess}
        </Alert>
      )}

      {/* Jamiat Section */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Jamiat Organizations</h3>
            <Button
              variant="primary"
              onClick={() => openJamiatModal()}
              className="flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Jamiat</span>
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-2 text-gray-600">Loading jamiat...</span>
            </div>
          ) : (
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.Header 
                    sortable 
                    sortDirection={jamiatSortField === 'name' ? jamiatSortDirection : null}
                    onSort={() => handleJamiatSort('name')}
                  >
                    Name
                  </Table.Header>
                  <Table.Header 
                    sortable 
                    sortDirection={jamiatSortField === 'jamiat_id' ? jamiatSortDirection : null}
                    onSort={() => handleJamiatSort('jamiat_id')}
                  >
                    Jamiat ID
                  </Table.Header>
                  <Table.Header 
                    sortable 
                    sortDirection={jamiatSortField === 'status' ? jamiatSortDirection : null}
                    onSort={() => handleJamiatSort('status')}
                  >
                    Status
                  </Table.Header>
                  <Table.Header 
                    sortable 
                    sortDirection={jamiatSortField === 'jamaats_count' ? jamiatSortDirection : null}
                    onSort={() => handleJamiatSort('jamaats_count')}
                  >
                    Jamaats
                  </Table.Header>
                  <Table.Header 
                    sortable 
                    sortDirection={jamiatSortField === 'created_at' ? jamiatSortDirection : null}
                    onSort={() => handleJamiatSort('created_at')}
                  >
                    Created
                  </Table.Header>
                  <Table.Header align="center">Actions</Table.Header>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {getPaginatedJamiat().map((item) => (
                  <Table.Row key={item.id} hover>
                    <Table.Cell>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        {item.description && (
                          <div className="text-sm text-gray-500">{item.description}</div>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="secondary">{item.jamiat_id}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={item.is_active ? 'primary' : 'secondary'}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-gray-600">
                        {getJamaatsByJamiat(item.id).length} jamaat(s)
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm text-gray-900">
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </Table.Cell>
                    <Table.Cell align="center">
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openJamiatModal(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteJamiat(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
          
          {/* Pagination for Jamiat */}
          {!loading && getSortedJamiat().length > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={jamiatCurrentPage}
                totalPages={getJamiatTotalPages()}
                onPageChange={setJamiatCurrentPage}
                rowsPerPage={jamiatRowsPerPage}
                onRowsPerPageChange={(newRowsPerPage) => {
                  setJamiatRowsPerPage(newRowsPerPage);
                  setJamiatCurrentPage(1);
                }}
                totalItems={getSortedJamiat().length}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Jamaat Section */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Jamaat Organizations</h3>
            <Button
              variant="primary"
              onClick={() => openJamaatModal()}
              className="flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Jamaat</span>
            </Button>
          </div>

          <Table>
            <Table.Head>
              <Table.Row>
                <Table.Header 
                  sortable 
                  sortDirection={jamaatSortField === 'name' ? jamaatSortDirection : null}
                  onSort={() => handleJamaatSort('name')}
                >
                  Jamaat Name
                </Table.Header>
                <Table.Header 
                  sortable 
                  sortDirection={jamaatSortField === 'jamaat_id' ? jamaatSortDirection : null}
                  onSort={() => handleJamaatSort('jamaat_id')}
                >
                  Jamaat ID
                </Table.Header>
                <Table.Header 
                  sortable 
                  sortDirection={jamaatSortField === 'jamiat' ? jamaatSortDirection : null}
                  onSort={() => handleJamaatSort('jamiat')}
                >
                  Jamiat
                </Table.Header>
                <Table.Header 
                  sortable 
                  sortDirection={jamaatSortField === 'status' ? jamaatSortDirection : null}
                  onSort={() => handleJamaatSort('status')}
                >
                  Status
                </Table.Header>
                <Table.Header 
                  sortable 
                  sortDirection={jamaatSortField === 'created_at' ? jamaatSortDirection : null}
                  onSort={() => handleJamaatSort('created_at')}
                >
                  Created
                </Table.Header>
                <Table.Header align="center">Actions</Table.Header>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {getPaginatedJamaat().map((item) => (
                <Table.Row key={item.id} hover>
                  <Table.Cell>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-gray-500">{item.description}</div>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="secondary">{item.jamaat_id}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm text-gray-600">{getJamiatName(item.jamiat_id)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={item.is_active ? 'primary' : 'secondary'}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </Table.Cell>
                  <Table.Cell align="center">
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openJamaatModal(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteJamaat(item.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          
          {/* Pagination for Jamaat */}
          {getSortedJamaat().length > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={jamaatCurrentPage}
                totalPages={getJamaatTotalPages()}
                onPageChange={setJamaatCurrentPage}
                rowsPerPage={jamaatRowsPerPage}
                onRowsPerPageChange={(newRowsPerPage) => {
                  setJamaatRowsPerPage(newRowsPerPage);
                  setJamaatCurrentPage(1);
                }}
                totalItems={getSortedJamaat().length}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Jamiat Modal */}
      <Modal
        isOpen={jamiatModalOpen}
        onClose={() => setJamiatModalOpen(false)}
        title={selectedJamiat ? 'Edit Jamiat' : 'Create New Jamiat'}
        size="md"
      >
        <div className="space-y-4">
          {jamiatError && (
            <Alert severity="error">
              {jamiatError}
            </Alert>
          )}
          
          <Input
            label="Jamiat Name"
            value={jamiatForm.name}
            onChange={(e) => setJamiatForm(prev => ({ ...prev, name: e.target.value }))}
            required
            placeholder="Enter jamiat name"
          />
          
          <Input
            label="Jamiat ID"
            value={jamiatForm.jamiat_id}
            onChange={(e) => setJamiatForm(prev => ({ ...prev, jamiat_id: e.target.value.toUpperCase() }))}
            required
            placeholder="Enter unique Jamiat ID"
          />
          
          <div className="flex items-center space-x-3">
            <Switch
              checked={jamiatForm.is_active}
              onChange={(checked) => setJamiatForm(prev => ({ ...prev, is_active: checked }))}
            />
            <span className="text-sm text-gray-700">Active</span>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <Button
            variant="outline"
            onClick={() => setJamiatModalOpen(false)}
            disabled={jamiatLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={selectedJamiat ? updateJamiat : createJamiat}
            loading={jamiatLoading}
          >
            {selectedJamiat ? 'Update Jamiat' : 'Create Jamiat'}
          </Button>
        </div>
      </Modal>

      {/* Jamaat Modal */}
      <Modal
        isOpen={jamaatModalOpen}
        onClose={() => setJamaatModalOpen(false)}
        title={selectedJamaat ? 'Edit Jamaat' : 'Create New Jamaat'}
        size="md"
      >
        <div className="space-y-4">
          {jamaatError && (
            <Alert severity="error">
              {jamaatError}
            </Alert>
          )}
          
          <Select
            label="Jamiat"
            value={jamaatForm.jamiat_id}
            onChange={(e) => setJamaatForm(prev => ({ ...prev, jamiat_id: e.target.value }))}
            required
          >
            <Select.Option value="">Select Jamiat</Select.Option>
            {jamiat.map(j => (
              <Select.Option key={j.id} value={j.id}>
                {j.name}
              </Select.Option>
            ))}
          </Select>
          
          <Input
            label="Jamaat Name"
            value={jamaatForm.name}
            onChange={(e) => setJamaatForm(prev => ({ ...prev, name: e.target.value }))}
            required
            placeholder="Enter jamaat name"
          />
          
          <Input
            label="Jamaat ID"
            value={jamaatForm.jamaat_id}
            onChange={(e) => setJamaatForm(prev => ({ ...prev, jamaat_id: e.target.value.toUpperCase() }))}
            required
            placeholder="Enter unique Jamaat ID"
          />
          
          <div className="flex items-center space-x-3">
            <Switch
              checked={jamaatForm.is_active}
              onChange={(checked) => setJamaatForm(prev => ({ ...prev, is_active: checked }))}
            />
            <span className="text-sm text-gray-700">Active</span>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <Button
            variant="outline"
            onClick={() => setJamaatModalOpen(false)}
            disabled={jamaatLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={selectedJamaat ? updateJamaat : createJamaat}
            loading={jamaatLoading}
          >
            {selectedJamaat ? 'Update Jamaat' : 'Create Jamaat'}
          </Button>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Jamiat and Jamaat Data"
        size="md"
      >
        <div className="space-y-4">
          {importError && (
            <Alert severity="error">
              {importError}
            </Alert>
          )}
          {importSuccess && (
            <Alert severity="success">
              {importSuccess}
            </Alert>
          )}
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Import Instructions:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Download the template first to see the required format</li>
              <li>• Fill in your data following the template structure</li>
              <li>• Upload the completed Excel file</li>
              <li>• Duplicate entries will be skipped automatically</li>
            </ul>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Excel File
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {selectedFile && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> The import process will create new jamiat and jamaat entries. 
              Existing entries with the same codes will be skipped.
            </p>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <Button
            variant="outline"
            onClick={() => {
              setImportModalOpen(false);
              setSelectedFile(null);
              setImportError('');
              setImportSuccess('');
            }}
            disabled={importLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={importExcel}
            loading={importLoading}
            disabled={!selectedFile}
          >
            Import Data
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default JamiatMaster;
