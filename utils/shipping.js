// Updated Shipping Calculator with REAL Shiprocket API
class ShippingCalculator {
  constructor() {
    this.shiprocketEnabled = process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD;
    this.pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '110030';
    
    // Keep your existing fixed rates as fallback
    this.shippingRates = {
      standard: {
        baseRate: 50,
        perKg: 25,
        minWeight: 0.5,
        maxWeight: 10,
        estimatedDays: '4-7 business days'
      },
      express: {
        baseRate: 100,
        perKg: 40,
        minWeight: 0.5,
        maxWeight: 5,
        estimatedDays: '2-3 business days'
      },
      overnight: {
        baseRate: 200,
        perKg: 60,
        minWeight: 0.5,
        maxWeight: 3,
        estimatedDays: 'Next business day'
      }
    };

    // ... keep your existing zones and multipliers
    this.zones = {
      'north': ['DL', 'HR', 'PB', 'UP', 'UK', 'HP', 'JK', 'CH'],
      'south': ['TN', 'KA', 'KL', 'AP', 'TS', 'PY'],
      'east': ['WB', 'OR', 'BH', 'JH', 'AS', 'NL', 'MN', 'TR', 'ML', 'MZ', 'SK'],
      'west': ['MH', 'GJ', 'RJ', 'GA', 'MP'],
      'central': ['MP', 'CT']
    };

    this.zoneMultipliers = {
      'north': 1.0,
      'south': 1.2,
      'east': 1.3,
      'west': 1.1,
      'central': 1.0
    };
  }

  // ✅ NEW: REAL Shiprocket API Integration
  async calculateShiprocketRates(deliveryPincode, weight, orderValue = 0) {
    try {
      if (!this.shiprocketEnabled) {
        throw new Error('Shiprocket credentials not configured');
      }

      console.log('🚀 Calling REAL Shiprocket API...');
      
      // 1. Authenticate with Shiprocket
      const authResponse = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: process.env.SHIPROCKET_EMAIL,
          password: process.env.SHIPROCKET_PASSWORD
        })
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        throw new Error(`Shiprocket auth failed: ${JSON.stringify(errorData)}`);
      }

      const authData = await authResponse.json();
      const token = authData.token;

      // 2. Calculate shipping rates
      const ratePayload = {
        pickup_postcode: this.pickupPincode,
        delivery_postcode: deliveryPincode,
        weight: weight,
        length: 15,
        breadth: 10,
        height: 5,
        cod: orderValue > 0 ? 0 : 1 // 0 for prepaid, 1 for COD
      };

      console.log('📦 Shiprocket rate payload:', ratePayload);

      const rateResponse = await fetch('https://apiv2.shiprocket.in/v1/external/courier/serviceability/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(ratePayload)
      });

      if (!rateResponse.ok) {
        const errorData = await rateResponse.json();
        throw new Error(`Shiprocket rates failed: ${JSON.stringify(errorData)}`);
      }

      const rateData = await rateResponse.json();
      console.log('✅ Raw Shiprocket response:', rateData);

      return this.formatShiprocketOptions(rateData, orderValue);

    } catch (error) {
      console.error('❌ Shiprocket API error:', error);
      throw error; // Re-throw to handle in calling function
    }
  }

  // ✅ Format Shiprocket API response
  formatShiprocketOptions(rateData, orderValue) {
    if (!rateData.data || !rateData.data.available_courier_companies) {
      throw new Error('No courier companies available from Shiprocket');
    }

    const options = rateData.data.available_courier_companies.map(courier => {
      // Apply free shipping for orders above ₹2000
      const charge = orderValue > 2000 ? 0 : courier.rate;
      
      return {
        id: `shiprocket_${courier.courier_company_id}`,
        name: courier.courier_name,
        charge: Math.round(charge),
        estimatedDays: courier.estimated_delivery_days || '4-7 days',
        provider: 'shiprocket',
        courier: courier.courier_name,
        freeShipping: orderValue > 2000,
        rawRate: courier.rate // Keep original rate for reference
      };
    });

    // Sort by price
    return options.sort((a, b) => a.charge - b.charge);
  }

  // ✅ UPDATED: Get all shipping options (Shiprocket + Fallback)
  async getAllShippingOptions(weight, state, orderValue = 0, deliveryPincode = null) {
    try {
      // Try Shiprocket first if we have delivery pincode
      if (deliveryPincode && this.shiprocketEnabled) {
        console.log('🎯 Using REAL Shiprocket rates');
        const shiprocketOptions = await this.calculateShiprocketRates(deliveryPincode, weight, orderValue);
        return shiprocketOptions;
      }
      
      // Fallback to custom calculator
      console.log('📦 Using custom shipping rates (fallback)');
      return this.getCustomShippingOptions(weight, state, orderValue);
      
    } catch (error) {
      console.error('❌ Shiprocket failed, using fallback:', error.message);
      return this.getCustomShippingOptions(weight, state, orderValue);
    }
  }

  // ✅ Renamed: Your existing custom calculator as fallback
  getCustomShippingOptions(weight, state, orderValue = 0) {
    const options = [];
    const services = Object.keys(this.shippingRates);

    for (const service of services) {
      try {
        const shipping = this.calculateShipping(weight, state, service);
        
        // Apply free shipping for orders above ₹2000
        if (orderValue > 2000 && service === 'standard') {
          shipping.cost = 0;
          shipping.freeShipping = true;
        }

        options.push({
          id: `custom_${service}`,
          name: this.getServiceName(service),
          provider: 'custom',
          courier: service,
          charge: shipping.cost,
          estimatedDays: shipping.estimatedDays,
          freeShipping: shipping.freeShipping || false
        });
      } catch (error) {
        console.warn(`Skipping ${service} shipping: ${error.message}`);
      }
    }

    return options.sort((a, b) => a.charge - b.charge);
  }

  // ✅ Keep your existing methods
  calculateShipping(weight, state, service = 'standard') {
    const serviceRates = this.shippingRates[service];
    
    if (!serviceRates) {
      throw new Error(`Invalid shipping service: ${service}`);
    }

    if (weight < serviceRates.minWeight) weight = serviceRates.minWeight;
    if (weight > serviceRates.maxWeight) {
      throw new Error(`Weight exceeds maximum limit for ${service} shipping`);
    }

    let cost = serviceRates.baseRate;
    const additionalWeight = Math.max(0, weight - serviceRates.minWeight);
    cost += Math.ceil(additionalWeight) * serviceRates.perKg;

    const zone = this.getZone(state);
    cost *= this.zoneMultipliers[zone];
    cost = Math.ceil(cost / 5) * 5;

    return {
      cost: Math.round(cost),
      service,
      estimatedDays: serviceRates.estimatedDays,
      weight: weight,
      zone
    };
  }

  getZone(stateCode) {
    for (const [zone, states] of Object.entries(this.zones)) {
      if (states.includes(stateCode.toUpperCase())) {
        return zone;
      }
    }
    return 'north';
  }

  getServiceName(service) {
    const names = {
      standard: 'Standard Shipping',
      express: 'Express Shipping',
      overnight: 'Overnight Shipping'
    };
    return names[service] || service;
  }

  // ... keep your other existing methods
}

module.exports = ShippingCalculator;


