// Report Generation Utilities
const ExcelJS = require('exceljs');
const Analytics = require('./analytics');
const InventoryManager = require('./inventoryManager');

class ReportGenerator {
  // Generate sales report
  static async generateSalesReport(timeframe = '30d', format = 'excel') {
    const analytics = await Analytics.getSalesAnalytics(timeframe);
    const productAnalytics = await Analytics.getProductAnalytics();
    const paymentAnalytics = await Analytics.getPaymentAnalytics();

    if (format === 'excel') {
      return await this.generateExcelReport({
        sales: analytics,
        products: productAnalytics,
        payments: paymentAnalytics,
        timeframe
      });
    } else if (format === 'json') {
      return {
        sales: analytics,
        products: productAnalytics,
        payments: paymentAnalytics,
        generatedAt: new Date(),
        timeframe
      };
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  // Generate inventory report
  static async generateInventoryReport(format = 'excel') {
    const inventorySummary = await InventoryManager.getInventorySummary();
    const lowStockAlerts = await InventoryManager.getLowStockAlerts();

    if (format === 'excel') {
      return await this.generateInventoryExcelReport(inventorySummary, lowStockAlerts);
    }

    return {
      inventorySummary,
      lowStockAlerts,
      generatedAt: new Date()
    };
  }

  // Generate Excel sales report
  static async generateExcelReport(data) {
    const workbook = new ExcelJS.Workbook();
    
    // Sales Summary Sheet
    const salesSheet = workbook.addWorksheet('Sales Summary');
    salesSheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Orders', key: 'orders', width: 10 },
      { header: 'Revenue (₹)', key: 'revenue', width: 15 },
      { header: 'AOV (₹)', key: 'aov', width: 12 },
      { header: 'Items Sold', key: 'items', width: 12 }
    ];

    data.sales.salesData.forEach(day => {
      salesSheet.addRow({
        date: day._id,
        orders: day.orderCount,
        revenue: day.totalSales,
        aov: day.averageOrderValue,
        items: day.itemsSold
      });
    });

    // Products Sheet
    const productsSheet = workbook.addWorksheet('Top Products');
    productsSheet.columns = [
      { header: 'Product', key: 'product', width: 30 },
      { header: 'Units Sold', key: 'sold', width: 12 },
      { header: 'Revenue (₹)', key: 'revenue', width: 15 },
      { header: 'Avg Price (₹)', key: 'price', width: 12 }
    ];

    data.products.topProducts.forEach(product => {
      productsSheet.addRow({
        product: product._id,
        sold: product.totalSold,
        revenue: product.totalRevenue,
        price: product.averagePrice
      });
    });

    // Add summary cells
    salesSheet.addRow([]);
    salesSheet.addRow(['TOTAL', 
      data.sales.summary.totalOrders, 
      data.sales.summary.totalRevenue, 
      data.sales.summary.averageOrderValue, 
      ''
    ]);

    return workbook;
  }

  // Generate inventory Excel report
  static async generateInventoryExcelReport(summary, lowStock) {
    const workbook = new ExcelJS.Workbook();
    
    // Inventory Summary Sheet
    const summarySheet = workbook.addWorksheet('Inventory Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Value', key: 'value', width: 15 }
    ];

    summarySheet.addRow({ metric: 'Total Products', value: summary.totalProducts });
    summarySheet.addRow({ metric: 'Total Inventory Value', value: summary.totalInventoryValue });
    summarySheet.addRow({ metric: 'Out of Stock Items', value: summary.outOfStock });
    summarySheet.addRow({ metric: 'Low Stock Items', value: summary.lowStock });

    // Low Stock Alerts Sheet
    const alertsSheet = workbook.addWorksheet('Low Stock Alerts');
    alertsSheet.columns = [
      { header: 'Product', key: 'product', width: 30 },
      { header: 'Current Stock', key: 'stock', width: 15 },
      { header: 'Alert Level', key: 'alert', width: 12 },
      { header: 'Price (₹)', key: 'price', width: 12 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    lowStock.forEach(product => {
      alertsSheet.addRow({
        product: product.name,
        stock: product.inventory.quantity,
        alert: product.inventory.lowStockAlert,
        price: product.price,
        status: product.inventory.quantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK'
      });
    });

    return workbook;
  }

  // Generate daily sales email report
  static async generateDailyEmailReport() {
    const dashboardStats = await Analytics.getDashboardStats();
    const lowStockAlerts = await InventoryManager.getLowStockAlerts();

    const report = {
      subject: `Daily Sales Report - ${new Date().toDateString()}`,
      stats: dashboardStats,
      lowStockAlerts: lowStockAlerts.slice(0, 5), // Top 5 low stock items
      generatedAt: new Date()
    };

    return report;
  }

  // Generate customer report
  static async generateCustomerReport() {
    const customerAnalytics = await Analytics.getCustomerAnalytics();
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Customer Analytics');
    
    sheet.columns = [
      { header: 'Customer Email', key: 'email', width: 30 },
      { header: 'Total Orders', key: 'orders', width: 12 },
      { header: 'Total Spent (₹)', key: 'spent', width: 15 },
      { header: 'First Order', key: 'first', width: 15 },
      { header: 'Last Order', key: 'last', width: 15 },
      { header: 'AOV (₹)', key: 'aov', width: 12 }
    ];

    customerAnalytics.topCustomers.forEach(customer => {
      sheet.addRow({
        email: customer.email,
        orders: customer.totalOrders,
        spent: customer.totalSpent,
        first: customer.firstOrderDate.toDateString(),
        last: customer.lastOrderDate.toDateString(),
        aov: customer.averageOrderValue
      });
    });

    return workbook;
  }
}

module.exports = ReportGenerator;