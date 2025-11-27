const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

exports.sendOrderConfirmationEmail = async (order) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: order.customer.email,
    subject: `Order Confirmation - ${order.orderId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #007bff;">Thank you for your order!</h2>
        <p>Hello ${order.customer.name},</p>
        <p>Your order <strong>${order.orderId}</strong> has been confirmed.</p>
        
        <h3>Order Summary:</h3>
        ${order.items.map(item => `
          <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
            <strong>${item.name}</strong> x ${item.quantity} - ₹${item.price * item.quantity}
          </div>
        `).join('')}
        
        <div style="margin-top: 20px; padding: 15px; background: #f8f9fa;">
          <strong>Total: ₹${order.pricing.total}</strong>
        </div>
        
        <h3>Shipping Address:</h3>
        <p>${order.shippingAddress.line1}<br>
           ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}</p>
        
        <p>We'll notify you when your order ships.</p>
        <p>Thank you for shopping with MyBrand!</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Confirmation email sent to ${order.customer.email}`);
  } catch (error) {
    console.error('❌ Email sending failed:', error);
  }
};

exports.sendShippingNotification = async (order, trackingNumber) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: order.customer.email,
    subject: `Your Order Has Shipped! - ${order.orderId}`,
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2 style="color: #28a745;">Your order is on the way! 🚚</h2>
        <p>Hello ${order.customer.name},</p>
        <p>Your order <strong>${order.orderId}</strong> has been shipped.</p>
        <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
        <p>Expected delivery: ${order.shipping.estimatedDelivery}</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};