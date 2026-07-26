import React, { useState, useEffect } from 'react';
import { FormField, Input, TextArea, Select, AsyncSelect, Button } from '../../components/common/index.js';
import { useFullUpdateSale } from '../../hooks/useSales.js';
import { saleService } from '../../services/saleService.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';

export default function SaleFullEditForm({ initialData, onSuccess, onCancel }) {
  const updateMutation = useFullUpdateSale();
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    customer: '',
    date: '',
    currency: 'ETB',

    amount_paid_now: '',
    payment_method: '',
    notes: ''
  });

  const [customerLabel, setCustomerLabel] = useState('');
  const [paymentMethodLabel, setPaymentMethodLabel] = useState('');

  useEffect(() => {
    if (initialData) {
      // Safely format the date for the HTML date input
      let formattedDate = '';
      if (initialData.date) {
        const d = new Date(initialData.date);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().split('T')[0];
        }
      }

      setFormData({
        customer: initialData.customer || '',
        date: formattedDate,
        currency: initialData.currency || 'ETB',

        amount_paid_now: initialData.amount_paid_now !== null && initialData.amount_paid_now !== undefined ? initialData.amount_paid_now : '',
        payment_method: initialData.payment_method || '',
        notes: initialData.notes || ''
      });

      // Pre-fill labels for AsyncSelect components
      if (initialData.customer_name) {
        setCustomerLabel(initialData.customer_name);
      }
      if (initialData.payment_method) {
        const capLabel = initialData.payment_method.charAt(0).toUpperCase() + initialData.payment_method.slice(1).replace('_', ' ');
        setPaymentMethodLabel(capLabel);
      }
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleCustomerChange = (value) => {
    setFormData(prev => ({ ...prev, customer: value }));
    if (errors.customer) setErrors(prev => ({ ...prev, customer: null }));
  };

  const handlePaymentMethodChange = (value) => {
    setFormData(prev => ({ ...prev, payment_method: value }));
    if (errors.payment_method) setErrors(prev => ({ ...prev, payment_method: null }));
  };

  const fetchCustomerOptions = async (query) => {
    try {
      const res = await saleService.getCustomerOptions(query);
      return Array.isArray(res) ? res : (res.results || []);
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const fetchPaymentMethodOptions = async (query) => {
    try {
      const res = await saleService.getPaymentMethodOptions(query);
      return Array.isArray(res) ? res : (res.results || []);
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const newErrors = {};
    if (!formData.customer) newErrors.customer = 'Customer is required.';
    if (!formData.date) newErrors.date = 'Date is required.';
    if (!formData.currency) newErrors.currency = 'Currency is required.';

    if (formData.amount_paid_now === '' || formData.amount_paid_now === null) newErrors.amount_paid_now = 'Amount paid is required.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast.error('Validation Error', 'Please complete all required fields.');
      return;
    }

    // payment_type is determined server-side
    const payload = {
      customer: formData.customer,
      date: formData.date,
      currency: formData.currency,
      amount_paid_now: parseFloat(formData.amount_paid_now || 0),
      payment_method: formData.payment_method,
      notes: formData.notes
    };

    const toastId = showToast.loading('Updating sale...');
    updateMutation.mutate(
      { id: initialData.id, data: payload },
      {
        onSuccess: () => {
          showToast.success('Updated', 'Sale updated successfully');
          showToast.dismiss(toastId);
          onSuccess();
        },
        onError: (err) => {
          showToast.dismiss(toastId);
          handleBackendErrors(err, setErrors, 'Failed to update sale');
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Customer" required error={errors.customer}>
          <AsyncSelect
            loadOptions={fetchCustomerOptions}
            value={formData.customer}
            onChange={handleCustomerChange}
            placeholder="Search customers..."
            error={errors.customer}
          />
        </FormField>

        <FormField label="Date" required error={errors.date}>
          <Input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            error={errors.date}
            required
          />
        </FormField>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Currency" required error={errors.currency}>
          <Select
            name="currency"
            value={formData.currency}
            onChange={handleChange}
            error={errors.currency}
            options={[
              { value: 'ETB', label: 'ETB (Birr)' },
              { value: 'USD', label: 'USD ($)' },
              { value: 'EUR', label: 'EUR (€)' }
            ]}
          />
        </FormField>

        <FormField label="Payment Method" error={errors.payment_method}>
          <AsyncSelect
            loadOptions={fetchPaymentMethodOptions}
            value={formData.payment_method}
            onChange={handlePaymentMethodChange}
            placeholder="Search payment method..."
            error={errors.payment_method}
          />
        </FormField>
      </div>



      <FormField label="Amount Paid Now" required error={errors.amount_paid_now}>
        <Input
          type="number"
          name="amount_paid_now"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={formData.amount_paid_now}
          onChange={handleChange}
          error={errors.amount_paid_now}
          required
        />
      </FormField>

      <FormField label="Notes" error={errors.notes}>
        <TextArea
          name="notes"
          placeholder="Enter any additional notes..."
          rows={3}
          value={formData.notes}
          onChange={handleChange}
          error={errors.notes}
        />
      </FormField>

      <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
        <Button type="button" variant="outline" onClick={onCancel} disabled={updateMutation.isLoading}>
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
