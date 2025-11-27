// Shipping Calculation Utilities
class ShippingCalculator {
  constructor() {
    this.shippingRates = {
      standard: {
        baseRate: 50, // ₹50 base charge
        perKg: 25,    // ₹25 per additional kg
        minWeight: 0.5, // Minimum weight in kg
        maxWeight: 10,  // Maximum weight in kg
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

    // Zone-based pricing (distance from warehouse)
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

  // Calculate shipping cost based on weight and destination
  calculateShipping(weight, state, service = 'standard') {
    const serviceRates = this.shippingRates[service];
    
    if (!serviceRates) {
      throw new Error(`Invalid shipping service: ${service}`);
    }

    // Validate weight
    if (weight < serviceRates.minWeight) {
      weight = serviceRates.minWeight;
    }
    
    if (weight > serviceRates.maxWeight) {
      throw new Error(`Weight exceeds maximum limit for ${service} shipping`);
    }

    // Calculate base cost
    let cost = serviceRates.baseRate;
    
    // Add weight-based charges
    const additionalWeight = Math.max(0, weight - serviceRates.minWeight);
    cost += Math.ceil(additionalWeight) * serviceRates.perKg;

    // Apply zone multiplier
    const zone = this.getZone(state);
    cost *= this.zoneMultipliers[zone];

    // Round to nearest 5 rupees
    cost = Math.ceil(cost / 5) * 5;

    return {
      cost: Math.round(cost),
      service,
      estimatedDays: serviceRates.estimatedDays,
      weight: weight,
      zone
    };
  }

  // Get all available shipping options
  getAllShippingOptions(weight, state, orderValue = 0) {
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
          name: this.getServiceName(service),
          provider: 'mybrand',
          courier: service,
          charge: shipping.cost,
          estimatedDays: shipping.estimatedDays,
          freeShipping: shipping.freeShipping || false
        });
      } catch (error) {
        // Skip services that don't support the weight
        console.warn(`Skipping ${service} shipping: ${error.message}`);
      }
    }

    // Sort by price (cheapest first)
    return options.sort((a, b) => a.charge - b.charge);
  }

  // Get zone from state code
  getZone(stateCode) {
    for (const [zone, states] of Object.entries(this.zones)) {
      if (states.includes(stateCode.toUpperCase())) {
        return zone;
      }
    }
    return 'north'; // Default zone
  }

  // Get human-readable service name
  getServiceName(service) {
    const names = {
      standard: 'Standard Shipping',
      express: 'Express Shipping',
      overnight: 'Overnight Shipping'
    };
    return names[service] || service;
  }

  // Calculate package weight from order items
  calculateOrderWeight(items) {
    const itemWeight = 0.3; // 0.3kg per t-shirt (including packaging)
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const weight = totalItems * itemWeight;
    
    // Minimum weight 0.5kg
    return Math.max(weight, 0.5);
  }

  // Validate shipping address
  validateShippingAddress(address) {
    const errors = [];

    if (!address.pincode || address.pincode.length !== 6) {
      errors.push('Valid 6-digit pincode is required');
    }

    if (!address.state) {
      errors.push('State is required');
    }

    if (!address.city) {
      errors.push('City is required');
    }

    if (!address.line1) {
      errors.push('Address line 1 is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get shipping zones information
  getZonesInfo() {
    return this.zones;
  }
}

module.exports = ShippingCalculator;