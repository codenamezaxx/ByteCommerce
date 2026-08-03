// P8.2 — Admin controller.
// Layer ini HANYA membaca req, memanggil service, dan mengirim respons — TANPA SQL.
const adminService = require('./admin.service');

const adminController = {
  dashboard: async (req, res) => {
    const metrics = await adminService.getDashboardMetrics();
    res.success({ metrics }, 'Dashboard metrics fetched');
  },
};

module.exports = adminController;
