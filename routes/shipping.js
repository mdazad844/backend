const express = require('express');
const router = express.Router();
const ShippingCalculator = require('../utils/shipping'); // ✅ Fixed import

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

        // Use your ShippingCalculator instead of Shiprocket
        const shippingOptions = shippingCalculator.getAllShippingOptions(
            orderWeight, 
            state, 
            orderValue || 0
        );

        // Add manual rates as fallback
        const manualRates = getManualShippingRates(orderValue || 0);
        const allOptions = [...shippingOptions, ...manualRates];

        // Remove duplicates and sort
        const uniqueOptions = allOptions.filter((option, index, self) =>
            index === self.findIndex(o => o.name === option.name)
        ).sort((a, b) => a.charge - b.charge);

        res.json({
            success: true,
            shippingOptions: uniqueOptions,
            deliveryPincode,
            orderWeight
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
