/**
 * Family Dues API Client
 * All requests use GET to avoid CORS preflight issues with Google Apps Script Web Apps
 */

const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbzVN0YwMOsDnJfq__6rBKH5Zox_pdWHjkkPJ1ALxayCCApj_t8hGakshXHABKmvUMDY/exec';

async function apiCall(action, params = {}, options = {}) {
  const session = getSession();
  const query = new URLSearchParams({ action, ...params });

  if (session && session.token && action !== 'login') {
    query.set('token', session.token);
  }

  const url = `${BACKEND_URL}?${query.toString()}`;
  const silent = options.silent === true;

  try {
    if (!silent) showLoading(true);
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    const data = await response.json();

    if (!data.success && data.error && data.error.toLowerCase().includes('session')) {
      clearSession();
      window.location.href = 'index.html';
      return data;
    }

    return data;
  } catch (err) {
    return { success: false, data: {}, error: err.message || 'Network error' };
  } finally {
    if (!silent) showLoading(false);
  }
}

const API = {
  login: (username, password) =>
    apiCall('login', { username, password }),

  getConfig: () =>
    apiCall('getConfig'),

  getDashboardData: (year = 'all') =>
    apiCall('getDashboardData', { year: String(year) }),

  getMembers: (filter = 'all') =>
    apiCall('getMembers', { filter }),

  getMemberById: (memberId) =>
    apiCall('getMemberById', { memberId }),

  addMember: (data) =>
    apiCall('addMember', data),

  updateMember: (data) =>
    apiCall('updateMember', data),

  deleteMember: (memberId) =>
    apiCall('deleteMember', { memberId }),

  getUsers: () =>
    apiCall('getUsers'),

  createUser: (data) =>
    apiCall('createUser', data),

  updateUserRole: (userId, role) =>
    apiCall('updateUserRole', { userId, role }),

  resetPassword: (userId) =>
    apiCall('resetPassword', { userId }),

  toggleUserActive: (userId, isActive) =>
    apiCall('toggleUserActive', { userId, isActive: String(isActive) }),

  recordPayment: (data) => {
    const payload = Object.assign({}, data);
    if (payload.allocations && typeof payload.allocations !== 'string') {
      payload.allocations = JSON.stringify(payload.allocations);
    }
    return apiCall('recordPayment', payload);
  },

  getMemberDuesStatus: (memberId) =>
    apiCall('getMemberDuesStatus', { memberId }),

  getPayments: (filters = {}) =>
    apiCall('getPayments', filters),

  getPaymentsByMember: (memberId) =>
    apiCall('getPaymentsByMember', { memberId }),

  deletePayment: (paymentId, reason) =>
    apiCall('deletePayment', { paymentId, reason }),

  getMonthlySummary: (month) =>
    apiCall('getMonthlySummary', { month }),

  getMemberHistory: (memberId) =>
    apiCall('getMemberHistory', { memberId }),

  getOverdueMembers: (month) =>
    apiCall('getOverdueMembers', { month }),

  getYearEndSummary: (year) =>
    apiCall('getYearEndSummary', { year }),

  getTotalCollections: (year = 'all') =>
    apiCall('getTotalCollections', { year: String(year) }),

  getDuesMatrixReport: (year, startMonth = 1) =>
    apiCall('getDuesMatrixReport', { year: String(year), startMonth: String(startMonth) }),

  recordDisbursement: (data) =>
    apiCall('recordDisbursement', data),

  getDisbursements: (year = 'all') =>
    apiCall('getDisbursements', { year: String(year) }),

  deleteDisbursement: (disbursementId, reason) =>
    apiCall('deleteDisbursement', { disbursementId, reason }),

  sendReminders: () =>
    apiCall('sendReminders'),

  sendReminderToMember: (memberId, month) =>
    apiCall('sendReminderToMember', { memberId, month })
};
