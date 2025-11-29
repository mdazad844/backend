const express = require('express');
const router = express.Router();
const ShippingCalculator = require('../utils/shipping');

const shippingCalculator = new ShippingCalculator();

// Calculate shipping rates
router.post('/calculate', async (req, res) => {
    try {
        const { deliveryPincode, orderWeight, orderValue, state = 'DL' } = req.body;

        if (!deliveryPincode || !orderWeight) {
            return res.status(400).json({
                success: false,
                error: 'Delivery pincode and order weight are required'
            });
        }

        console.log('🚀 Calculating shipping for:', { deliveryPincode, orderWeight, orderValue, state });

        // ✅ UPDATED: Pass deliveryPincode to get REAL Shiprocket rates
        const shippingOptions = await shippingCalculator.getAllShippingOptions(
            orderWeight, 
            state, 
            orderValue || 0,
            deliveryPincode // ✅ ADD THIS
        );

        console.log('📦 Final shipping options:', shippingOptions);

        res.json({
            success: true,
            shippingOptions: shippingOptions,
            deliveryPincode,
            orderWeight,
            provider: shippingOptions[0]?.provider || 'custom'
        });

    } catch (error) {
        console.error('Shipping calculation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate shipping',
            shippingOptions: getManualShippingRates(req.body.orderValue || 0)
        });
    }
});

function getManualShippingRates(orderValue) {
    const rates = [];
    
    if (orderValue > 999) {
        rates.push({
            id: 'free_manual',
            name: 'Free Shipping',
            charge: 0,
            estimatedDays: '4-7 days',
            provider: 'manual'
        });
    }
    
    rates.push(
        {
            id: 'standard_manual',
            name: 'Standard Delivery',
            charge: 50,
            estimatedDays: '5-8 days',
            provider: 'manual'
        },
        {
            id: 'express_manual',
            name: 'Express Delivery',
            charge: 100,
            estimatedDays: '2-3 days',
            provider: 'manual'
        }
    );
    
    return rates;
}

module.exports = router;
