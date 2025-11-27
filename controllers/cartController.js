let carts = [];

exports.getCart = async (req, res) => {
  try {
    let cart = carts.find(c => c.userId === req.user.id);
    
    if (!cart) {
      cart = { userId: req.user.id, items: [], totalAmount: 0 };
      carts.push(cart);
    }

    res.json(cart);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addToCart = async (req, res) => {
  try {
    res.json({ message: 'Add to cart - implement later' });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};