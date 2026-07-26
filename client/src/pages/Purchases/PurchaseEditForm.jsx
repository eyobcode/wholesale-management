import React, { useState } from 'react';
import { FormField, Input, TextArea, Button } from '../../components/common/index.js';
import { useUpdatePurchase } from '../../hooks/usePurchases.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';

export default function PurchaseEditForm({ initialData, onSuccess, onCancel }) {
  const updateMutation = useUpdatePurchase();

  const [formData, setFormData] = useState({
    amount_paid_now: initialData?.amount_paid_now || '',
    notes: initialData?.notes || ''
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Calculate diff (only send fields that actually changed)
    const payload = {};
    if (formData.amount_paid_now !== (initialData?.amount_paid_now || '')) {
      payload.amount_paid_now = formData.amount_paid_now === '' ? 0 : parseFloat(formData.amount_paid_now);
    }
    if (formData.notes !== (initialData?.notes || '')) {
      payload.notes = formData.notes;
    }

    if (Object.keys(payload).length === 0) {
      showToast.info('No changes', 'No changes were made to save.');
      onCancel();
      return;
    }

    const toastId = showToast.loading('Updating purchase...');
    updateMutation.mutate(
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
    <form onSubmit={handleSubmit} className="common-form">
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
          isLoading={updateMutation.isLoading}
          disabled={updateMutation.isLoading}
        >
          Save Changes
        </Button>
      </div>
    </form>
  );
}
