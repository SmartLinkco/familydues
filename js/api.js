/**
 * Family Dues API Client
 * All requests use GET to avoid CORS preflight issues with Google Apps Script Web Apps
 */

const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbzx6hl_tLWgl8otJAsIYaRxfWivP9FDSXMeknNLginlyPqxJL71qeRvXWJHQXfCxEMn/exec';

async function apiCall(action, params = {}) {
  const session = getSession();
  const query = new URLSearchParams({ action, ...params });

  if (session && session.token && action !== 'login') {
    query.set('token', session.token);
  }

  const url = `${BACKEND_URL}?${query.toString()}`;

  try {
    showLoading(true);
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
    showLoading(false);
  }
}

const API = {
  login: (username, password) =>
    apiCall('login', { username, password }),

  getConfig: () =>
    apiCall('getConfig'),

  getDashboardData: () =>
    apiCall('getDashboardData'),

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

  recordPayment: (data) =>
    apiCall('recordPayment', data),

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

  sendReminders: () =>
    apiCall('sendReminders'),

  sendReminderToMember: (memberId, month) =>
    apiCall('sendReminderToMember', { memberId, month })
};
