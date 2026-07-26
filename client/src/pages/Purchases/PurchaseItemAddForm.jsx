import React, { useState } from 'react';
import { Input, Select, Button, FormField } from '../../components/common/index.js';
import { useCreatePurchaseItem } from '../../hooks/usePurchases.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';

export default function PurchaseItemAddForm({ purchaseId, onClose }) {
  const createMutation = useCreatePurchaseItem();
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    item_code: '',
    product_name: '',
    price_type: 'per_piece',
    purchase_price: '',
    pcs_per_bag: '',
    total_bags_purchased: '',
    currency: 'ETB'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleRadioChange = (value) => {
    setFormData(prev => ({
      ...prev,
      price_type: value
    }));
    if (errors.price_type) {
      setErrors(prev => ({ ...prev, price_type: null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    
    const toastId = showToast.loading('Adding purchase item...');
    
    const payload = {
      ...formData,
      purchase: purchaseId,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : 0,
      pcs_per_bag: formData.pcs_per_bag ? parseInt(formData.pcs_per_bag, 10) : 0,
      total_bags_purchased: formData.total_bags_purchased ? parseInt(formData.total_bags_purchased, 10) : 0
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        showToast.success('Added', 'Purchase item added successfully');
        showToast.dismiss(toastId);
        onClose();
      },
      onError: (err) => {
        showToast.dismiss(toastId);
        handleBackendErrors(err, setErrors, 'Failed to add purchase item');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="common-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} noValidate>
      
      {(errors.message || errors.non_field_errors) && (
        <div className="form-error-alert">
          <i className="ri-error-warning-line"></i>
          <span>{errors.message || errors.non_field_errors}</span>
        </div>
      )}

      <FormField label="Item Code" required error={errors.item_code}>
        <Input
          name="item_code"
          value={formData.item_code}
          onChange={handleChange}
          error={errors.item_code}
          required
        />
      </FormField>

      <FormField label="Product Name" required error={errors.product_name}>
        <Input
          name="product_name"
          value={formData.product_name}
          onChange={handleChange}
          error={errors.product_name}
          required
        />
      </FormField>

      <FormField label="Price Type" required error={errors.price_type}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="price_type" 
              value="per_piece" 
              checked={formData.price_type === 'per_piece'} 
              onChange={() => handleRadioChange('per_piece')} 
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
            />
            <span>Per Piece</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="price_type" 
              value="per_bag" 
              checked={formData.price_type === 'per_bag'} 
              onChange={() => handleRadioChange('per_bag')} 
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
            />
            <span>Per Bag</span>
          </label>
        </div>
      </FormField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Purchase Price" required error={errors.purchase_price}>
          <Input
            name="purchase_price"
            type="number"
            step="0.01"
            value={formData.purchase_price}
            onChange={handleChange}
            error={errors.purchase_price}
            required
          />
        </FormField>

        <FormField label="Currency" required error={errors.currency}>
          <Select 
            name="currency"
            value={formData.currency}
            onChange={handleChange}
            options={[
              { label: 'ETB (Birr)', value: 'ETB' },
              { label: 'USD (Dollar)', value: 'USD' }
            ]}
          />
        </FormField>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Pieces Per Bag" required error={errors.pcs_per_bag}>
          <Input
            name="pcs_per_bag"
            type="number"
            value={formData.pcs_per_bag}
            onChange={handleChange}
            error={errors.pcs_per_bag}
            required
          />
        </FormField>
        
        <FormField label="Total Bags Purchased" required error={errors.total_bags_purchased}>
          <Input
            name="total_bags_purchased"
            type="number"
            value={formData.total_bags_purchased}
            onChange={handleChange}
            error={errors.total_bags_purchased}
            required
          />
        </FormField>
      </div>

      <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
        <Button 
          type="button" 
          variant="outline" 
          onClick={onClose}
          disabled={createMutation.isLoading}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="primary"
          isLoading={createMutation.isLoading}
        >
          Add Item
        </Button>
      </div>
    </form>
  );
}
