exports.createOrder = async (req, res) => {
  try {
    res.json({ message: 'Create order - implement later' });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};