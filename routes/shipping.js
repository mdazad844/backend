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


// Add this temporary debug route
router.post('/debug-shiprocket', async (req, res) => {
    try {
        console.log('🔧 Shiprocket Debug Info:');
        
        // Check environment variables
        const envStatus = {
            SHIPROCKET_EMAIL: !!process.env.SHIPROCKET_EMAIL,
            SHIPROCKET_PASSWORD: !!process.env.SHIPROCKET_PASSWORD,
            SHIPROCKET_PICKUP_PINCODE: process.env.SHIPROCKET_PICKUP_PINCODE || 'Not set'
        };
        
        console.log('🔐 Environment Variables:', envStatus);
        
        // Test Shiprocket authentication
        if (envStatus.SHIPROCKET_EMAIL && envStatus.SHIPROCKET_PASSWORD) {
            try {
                const authResponse = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: process.env.SHIPROCKET_EMAIL,
                        password: process.env.SHIPROCKET_PASSWORD
                    })
                });
                
                console.log('🔑 Shiprocket Auth Status:', authResponse.status);
                
                if (authResponse.ok) {
                    const authData = await authResponse.json();
                    console.log('✅ Shiprocket Auth Success - Token received');
                    
                    // Test rate calculation
                    const rateResponse = await fetch('https://apiv2.shiprocket.in/v1/external/courier/serviceability/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authData.token}`
                        },
                        body: JSON.stringify({
                            pickup_postcode: process.env.SHIPROCKET_PICKUP_PINCODE || '110030',
                            delivery_postcode: '560001',
                            weight: 2.0,
                            length: 15,
                            breadth: 10,
                            height: 5,
                            cod: 0
                        })
                    });
                    
                    console.log('📦 Shiprocket Rate Status:', rateResponse.status);
                    
                    if (rateResponse.ok) {
                        const rateData = await rateResponse.json();
                        console.log('🎉 Shiprocket Rates Success:', rateData);
                        return res.json({
                            status: 'SUCCESS',
                            envStatus,
                            auth: 'Working',
                            rates: 'Working',
                            rawResponse: rateData
                        });
                    } else {
                        const error = await rateResponse.text();
                        console.log('❌ Shiprocket Rates Failed:', error);
                        return res.json({
                            status: 'RATES_FAILED',
                            envStatus,
                            auth: 'Working',
                            rates: 'Failed',
                            error: error
                        });
                    }
                    
                } else {
                    const error = await authResponse.text();
                    console.log('❌ Shiprocket Auth Failed:', error);
                    return res.json({
                        status: 'AUTH_FAILED',
                        envStatus,
                        auth: 'Failed',
                        error: error
                    });
                }
                
            } catch (apiError) {
                console.log('❌ Shiprocket API Error:', apiError);
                return res.json({
                    status: 'API_ERROR',
                    envStatus,
                    error: apiError.message
                });
            }
        } else {
            console.log('❌ Missing Shiprocket credentials');
            return res.json({
                status: 'MISSING_CREDENTIALS',
                envStatus
            });
        }
        
    } catch (error) {
        console.log('❌ Debug endpoint error:', error);
        res.status(500).json({
            status: 'DEBUG_ERROR',
            error: error.message
        });
    }
});


module.exports = router;
