import React, { useState } from 'react';
import { FormField, Input, TextArea, Button } from '../../components/common/index.js';
import { AsyncSelect } from '../../components/common/Form/AsyncSelect.jsx';
import { purchaseService } from '../../services/purchaseService.js';
import { useReplacePurchase } from '../../hooks/usePurchases.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';

export default function PurchaseFullEditForm({ initialData, onSuccess, onCancel }) {
  const replaceMutation = useReplacePurchase();
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    factory: initialData?.factory || '',
    date: initialData?.date ? initialData.date.substring(0, 10) : '',
    currency: initialData?.currency || 'ETB',
    payment_method: initialData?.payment_method || '',
    amount_paid_now: initialData?.amount_paid_now || '',
    notes: initialData?.notes || ''
  });

  const loadFactoryOptions = async (search) => {
    const res = await purchaseService.getFactoryOptions(search);
    return res;
  };

  const loadPaymentMethodOptions = async (search) => {
    try {
      const res = await purchaseService.getPaymentMethodOptions(search);
      return Array.isArray(res) ? res : (res.results || []);
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});

    const payload = {
      ...formData,
      amount_paid_now: formData.amount_paid_now === '' ? 0 : parseFloat(formData.amount_paid_now),
      payment_method: formData.payment_method || null
    };

    const toastId = showToast.loading('Updating purchase...');
    replaceMutation.mutate(
      { id: initialData.id, data: payload },
      {
        onSuccess: () => {
          showToast.success('Updated', 'Purchase updated successfully');
          showToast.dismiss(toastId);
          onSuccess();
        },
        onError: (err) => {
          handleBackendErrors(err, setErrors, 'Update Failed');
          showToast.dismiss(toastId);
        }
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="common-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} noValidate>
      
      {(errors.message || errors.non_field_errors) && (
        <div className="form-error-alert">
          <i className="ri-error-warning-line"></i>
          <span>{errors.message || errors.non_field_errors}</span>
        </div>
      )}

      <FormField label="Factory" error={errors.factory}>
        <AsyncSelect
          loadOptions={loadFactoryOptions}
          value={formData.factory}
          onChange={(val) => handleChange('factory', val)}
          placeholder="Search and select factory..."
        />
      </FormField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Purchase Date" error={errors.date}>
          <Input
            type="date"
            value={formData.date}
            onChange={(e) => handleChange('date', e.target.value)}
            error={errors.date}
            required
          />
        </FormField>

        <FormField label="Currency" error={errors.currency}>
          <Input
            value={formData.currency}
            onChange={(e) => handleChange('currency', e.target.value)}
            error={errors.currency}
            required
          />
        </FormField>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Payment Method" error={errors.payment_method}>
          <AsyncSelect
            loadOptions={loadPaymentMethodOptions}
            value={formData.payment_method}
            onChange={(val) => handleChange('payment_method', val)}
            placeholder="Search payment method..."
          />
        </FormField>

        <FormField label="Amount Paid Now" error={errors.amount_paid_now}>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.amount_paid_now}
            onChange={(e) => handleChange('amount_paid_now', e.target.value)}
            error={errors.amount_paid_now}
          />
        </FormField>
      </div>

      <FormField label="Notes" error={errors.notes}>
        <TextArea
          placeholder="Enter notes..."
          rows={3}
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          error={errors.notes}
        />
      </FormField>

      <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="primary" 
          isLoading={replaceMutation.isLoading}
          disabled={replaceMutation.isLoading}
        >
          Save Changes
        </Button>
      </div>
    </form>
  );
}
