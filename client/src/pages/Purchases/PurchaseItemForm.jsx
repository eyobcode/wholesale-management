import React, { useState, useEffect } from 'react';
import { FormField, Input, Select, Button } from '../../components/common/index.js';
import { useUpdatePurchaseItem } from '../../hooks/usePurchases.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';

export default function PurchaseItemForm({ item, purchaseId, onClose }) {
  const updateMutation = useUpdatePurchaseItem();
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    purchase: purchaseId,
    item_code: '',
    product_name: '',
    price_type: 'per_piece',
    purchase_price: '',
    pcs_per_bag: '',
    total_bags_purchased: '',
    currency: 'ETB'
  });

  useEffect(() => {
    if (item) {
      setFormData({
        purchase: purchaseId, // Always include current purchase ID
        item_code: item.item_code || '',
        product_name: item.product_name || '',
        price_type: item.price_type || 'per_piece',
        purchase_price: item.purchase_price || '',
        pcs_per_bag: item.pcs_per_bag || '',
        total_bags_purchased: item.total_bags_purchased || '',
        currency: item.currency || 'ETB'
      });
    }
  }, [item, purchaseId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear field error on change
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    
    const toastId = showToast.loading('Saving purchase item...');
    
    // Ensure numeric fields are cast properly
    const payload = {
      ...formData,
      purchase: purchaseId,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : 0,
      pcs_per_bag: formData.pcs_per_bag ? parseInt(formData.pcs_per_bag, 10) : 0,
      total_bags_purchased: formData.total_bags_purchased ? parseInt(formData.total_bags_purchased, 10) : 0
    };

    updateMutation.mutate({ id: item.id, data: payload }, {
      onSuccess: () => {
        showToast.success('Saved', 'Purchase item updated successfully');
        showToast.dismiss(toastId);
        onClose();
      },
      onError: (err) => {
        showToast.dismiss(toastId);
        handleBackendErrors(err, setErrors, 'Failed to update purchase item');
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Price Type" required error={errors.price_type}>
          <Select
            name="price_type"
            value={formData.price_type}
            onChange={handleChange}
            error={errors.price_type}
            options={[
              { value: 'per_piece', label: 'Per Piece' },
              { value: 'per_bag', label: 'Per Bag' }
            ]}
            required
          />
        </FormField>
        
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

      <FormField label="Currency" required error={errors.currency}>
        <Input
          name="currency"
          value={formData.currency}
          onChange={handleChange}
          error={errors.currency}
          required
        />
      </FormField>

      <div className="form-actions">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onClose}
          disabled={updateMutation.isLoading}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="primary"
          isLoading={updateMutation.isLoading}
        >
          Save Changes
        </Button>
      </div>
    </form>
  );
}
