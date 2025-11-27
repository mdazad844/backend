let wishlists = [];

exports.getWishlist = async (req, res) => {
  try {
    let wishlist = wishlists.find(w => w.userId === req.user.id);
    
    if (!wishlist) {
      wishlist = { userId: req.user.id, items: [] };
      wishlists.push(wishlist);
    }

    res.json(wishlist);
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.toggleWishlist = async (req, res) => {
  try {
    res.json({ message: 'Toggle wishlist - implement later' });
  } catch (error) {
    console.error('Toggle wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};