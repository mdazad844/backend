const express = require('express');
const router = express.Router();
const ShiprocketIntegration = require('../utils/shipping');

const shiprocket = new ShiprocketIntegration();

// Calculate shipping rates
router.post('/calculate', async (req, res) => {
    try {
        const { deliveryPincode, orderWeight, orderValue, dimensions } = req.body;

        if (!deliveryPincode || !orderWeight) {
            return res.status(400).json({
                success: false,
                error: 'Delivery pincode and order weight are required'
            });
        }

        // Get Shiprocket rates
        const shiprocketRates = await shiprocket.calculateShipping(
            deliveryPincode,
            orderWeight,
            dimensions
        );

        // Add manual rates as fallback
        const manualRates = getManualShippingRates(orderValue);
        const allOptions = [...shiprocketRates, ...manualRates];

        // Remove duplicates and sort
        const uniqueOptions = allOptions.filter((option, index, self) =>
            index === self.findIndex(o => o.id === option.id)
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
