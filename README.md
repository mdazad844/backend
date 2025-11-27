# E-commerce Backend API

A complete Node.js backend for an e-commerce website with user authentication, product management, shopping cart, and wishlist functionality.

## Features

- User Registration & Login (JWT Authentication)
- Product Management
- Shopping Cart
- Wishlist
- Order Management
- RESTful API

## Tech Stack

- Node.js
- Express.js
- MongoDB
- JWT Authentication
- bcryptjs for password hashing

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/products` - Get all products
- `POST /api/cart/add` - Add to cart
- `POST /api/wishlist/toggle` - Toggle wishlist

## Environment Variables

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT secret key
- `JWT_EXPIRES_IN` - JWT expiration time
- `CLIENT_URL` - Frontend URL

## Deployment

Deployed on Railway.app