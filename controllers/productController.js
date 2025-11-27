// Temporary products data
let products = [
  {
    id: 1,
    name: "Classic White Hoodie",
    description: "Comfortable and stylish white hoodie for everyday wear",
    price: 999,
    originalPrice: 1299,
    images: ["images/product1.jpg"],
    category: "men",
    sizes: ["S", "M", "L", "XL"],
    colors: ["White", "Black", "Gray"],
    stock: 50,
    featured: true,
    tags: ["hoodie", "men", "casual"]
  },
  {
    id: 2,
    name: "Black Oversized T-Shirt",
    description: "Trendy oversized t-shirt for a relaxed look",
    price: 699,
    originalPrice: 899,
    images: ["images/product2.jpg"],
    category: "men",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Black", "White"],
    stock: 30,
    featured: true,
    tags: ["tshirt", "men", "oversized"]
  }
];

// Get all products
exports.getProducts = async (req, res) => {
  try {
    const { category, featured, search } = req.query;
    
    let filteredProducts = [...products];
    
    if (category) {
      filteredProducts = filteredProducts.filter(p => p.category === category);
    }
    
    if (featured) {
      filteredProducts = filteredProducts.filter(p => p.featured);
    }
    
    if (search) {
      filteredProducts = filteredProducts.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
      );
    }

    res.json({
      products: filteredProducts,
      totalPages: 1,
      currentPage: 1,
      total: filteredProducts.length
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single product
exports.getProduct = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get featured products
exports.getFeaturedProducts = async (req, res) => {
  try {
    const featuredProducts = products.filter(p => p.featured).slice(0, 8);
    res.json(featuredProducts);
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
  try {
    const categoryProducts = products.filter(p => p.category === req.params.category);
    res.json(categoryProducts);
  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};