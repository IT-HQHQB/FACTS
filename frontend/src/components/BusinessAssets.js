import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'react-query';
import axios from 'axios';
import { 
  Button, 
  Input, 
  Card, 
  Alert,
  Toast,
  Table
} from './ui';

const BusinessAssets = ({ caseId, onSave, onCancel }) => {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm({
    defaultValues: {
      // Cash in Hand
      cash_in_hand_last_year: 0,
      cash_in_hand_year1: 0,
      cash_in_hand_year2: 0,
      cash_in_hand_year3: 0,
      cash_in_hand_year4: 0,
      cash_in_hand_year5: 0,
      
      // Raw materials / stock
      raw_materials_last_year: 0,
      raw_materials_year1: 0,
      raw_materials_year2: 0,
      raw_materials_year3: 0,
      raw_materials_year4: 0,
      raw_materials_year5: 0,
      
      // Sale on Credit
      sale_on_credit_last_year: 0,
      sale_on_credit_year1: 0,
      sale_on_credit_year2: 0,
      sale_on_credit_year3: 0,
      sale_on_credit_year4: 0,
      sale_on_credit_year5: 0,
      
      // Machines / Equipment
      machines_equipment_last_year: 0,
      machines_equipment_year1: 0,
      machines_equipment_year2: 0,
      machines_equipment_year3: 0,
      machines_equipment_year4: 0,
      machines_equipment_year5: 0,
      
      // Vehicles
      vehicles_last_year: 0,
      vehicles_year1: 0,
      vehicles_year2: 0,
      vehicles_year3: 0,
      vehicles_year4: 0,
      vehicles_year5: 0,
      
      // Shop / Godown etc.
      shop_godown_last_year: 0,
      shop_godown_year1: 0,
      shop_godown_year2: 0,
      shop_godown_year3: 0,
      shop_godown_year4: 0,
      shop_godown_year5: 0,
      
      // Trademark / Goodwill
      trademark_goodwill_last_year: 0,
      trademark_goodwill_year1: 0,
      trademark_goodwill_year2: 0,
      trademark_goodwill_year3: 0,
      trademark_goodwill_year4: 0,
      trademark_goodwill_year5: 0,
      
      // Business liability - Purchase on Credit
      purchase_on_credit_last_year: 0,
      purchase_on_credit_year1: 0,
      purchase_on_credit_year2: 0,
      purchase_on_credit_year3: 0,
      purchase_on_credit_year4: 0,
      purchase_on_credit_year5: 0
    }
  });

  // Fetch existing data
  const { data: existingData, isLoading } = useQuery(
    ['businessAssets', caseId],
    () => axios.get(`/api/business-assets/${caseId}`).then(res => res.data),
    {
      enabled: !!caseId,
      onSuccess: (data) => {
        if (data) {
          Object.keys(data).forEach(key => {
            if (data[key] !== null && data[key] !== undefined) {
              setValue(key, data[key]);
            }
          });
        }
      }
    }
  );

  // Save mutation
  const saveMutation = useMutation(
    (data) => axios.post(`/api/business-assets/${caseId}`, data),
    {
      onSuccess: () => {
        setSuccess('Business assets data saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
        if (onSave) onSave();
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to save business assets data');
        setTimeout(() => setError(''), 5000);
      }
    }
  );

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await saveMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Asset categories configuration
  const assetCategories = [
    {
      key: 'cash_in_hand',
      label: 'a) Cash in Hand',
      description: 'Cash available in hand'
    },
    {
      key: 'raw_materials',
      label: 'b) Raw materials / stock',
      description: 'Raw materials and stock inventory'
    },
    {
      key: 'sale_on_credit',
      label: 'c) Sale on Credit **',
      description: 'Amount receivable from credit sales'
    },
    {
      key: 'machines_equipment',
      label: 'd) Machines / Equip.',
      description: 'Machinery and equipment value'
    },
    {
      key: 'vehicles',
      label: 'e) Vehicles',
      description: 'Vehicle assets value'
    },
    {
      key: 'shop_godown',
      label: 'f) Shop / Godown etc.',
      description: 'Shop, godown and property value'
    },
    {
      key: 'trademark_goodwill',
      label: 'g) Trademark / Goodwill',
      description: 'Trademark and goodwill value'
    }
  ];

  const liabilityCategories = [
    {
      key: 'purchase_on_credit',
      label: 'h) Purchase on Credit **',
      description: 'Amount payable for credit purchases'
    }
  ];

  const years = [
    { key: 'last_year', label: 'Last Year / As of now (actual)' },
    { key: 'year1', label: 'Year 1 (proj)' },
    { key: 'year2', label: 'Year 2 (proj)' },
    { key: 'year3', label: 'Year 3 (proj)' },
    { key: 'year4', label: 'Year 4 (proj)' },
    { key: 'year5', label: 'Year 5 (proj)' }
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-gray-600">Loading business assets data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <Alert type="error" message={error} />}
      {success && <Toast type="success" message={success} />}

      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            5. Business assets owned (at the end of the year)
          </h2>
          <p className="text-gray-600">
            Enter the projected values for business assets and liabilities for each year.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Business Assets Table */}
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category and Subcategory
                  </th>
                  {years.map(year => (
                    <th key={year.key} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {year.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assetCategories.map((category, index) => (
                  <tr key={category.key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {category.label}
                        </div>
                        <div className="text-sm text-gray-500">
                          {category.description}
                        </div>
                      </div>
                    </td>
                    {years.map(year => (
                      <td key={year.key} className="px-4 py-4 whitespace-nowrap">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-full text-center"
                          {...register(`${category.key}_${year.key}`, {
                            valueAsNumber: true,
                            min: { value: 0, message: 'Value must be positive' }
                          })}
                        />
                        {errors[`${category.key}_${year.key}`] && (
                          <div className="text-red-500 text-xs mt-1">
                            {errors[`${category.key}_${year.key}`].message}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Business Liabilities Section */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              6. Business liability - other than Qardan
            </h3>
            
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category and Subcategory
                    </th>
                    {years.map(year => (
                      <th key={year.key} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {year.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {liabilityCategories.map((category, index) => (
                    <tr key={category.key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {category.label}
                          </div>
                          <div className="text-sm text-gray-500">
                            {category.description}
                          </div>
                        </div>
                      </td>
                      {years.map(year => (
                        <td key={year.key} className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register(`${category.key}_${year.key}`, {
                              valueAsNumber: true,
                              min: { value: 0, message: 'Value must be positive' }
                            })}
                          />
                          {errors[`${category.key}_${year.key}`] && (
                            <div className="text-red-500 text-xs mt-1">
                              {errors[`${category.key}_${year.key}`].message}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Saving...' : 'Save Business Assets'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default BusinessAssets;
