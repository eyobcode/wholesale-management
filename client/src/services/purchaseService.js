import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api.js';

export const purchaseService = {
  async getPurchases(params = {}) {
    return await api.get('/purchases/', { params });
  },

  async getPurchase(id) {
    return await api.get(`/purchases/${id}/`);
  },

  async createPurchase(data) {
    return await api.post('/purchases/', data);
  },

  async getPurchaseItems(params = {}) {
    return await api.get('/purchase-items/', { params });
  },

  async createPurchaseItem(data) {
    return await api.post('/purchase-items/', data);
  },

  async updatePurchaseItem(id, data) {
    return await api.put(`/purchase-items/${id}/`, data);
  },

  async deletePurchaseItem(id) {
    return await api.delete(`/purchase-items/${id}/`);
  },

  async replacePurchase(id, data) {
    return await api.put(`/purchases/${id}/`, data);
  },

  async updatePurchase(id, data) {
    return await api.patch(`/purchases/${id}/`, data);
  },

  async deletePurchase(id) {
    return await api.delete(`/purchases/${id}/`);
  },
  
  async getFactoryOptions(search = '') {
    const res = await api.get('/factory-options/', { params: search ? { search } : {} });
    return res;
  },

  async getPaymentMethodOptions(search = '') {
    const res = await api.get('/payment-method-options/', { params: search ? { search } : {} });
    return res;
  }
};


