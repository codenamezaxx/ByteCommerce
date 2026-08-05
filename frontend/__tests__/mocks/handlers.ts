import { http, HttpResponse } from 'msw'

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'USER',
  created_at: '2026-08-01T00:00:00.000Z',
}

const mockAdmin = {
  id: 99,
  name: 'Admin',
  email: 'admin@bytecommerce.com',
  role: 'ADMIN',
  created_at: '2026-08-01T00:00:00.000Z',
}

const mockProducts = [
  { id: 1, name: 'Laptop ASUS ROG', price: 18500000, stock: 10, category: 'electronics', image_url: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=400', description: 'Laptop gaming performa tinggi' },
  { id: 2, name: 'iPhone 15 Pro', price: 19999000, stock: 15, category: 'electronics', image_url: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400', description: 'Smartphone flagship Apple' },
  { id: 3, name: 'Samsung Galaxy S24', price: 16500000, stock: 20, category: 'electronics', image_url: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400', description: 'Smartphone flagship Samsung' },
  { id: 4, name: 'AirPods Pro 2', price: 3499000, stock: 30, category: 'electronics', image_url: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=400', description: 'TWS earbuds Apple' },
  { id: 5, name: 'PlayStation 5', price: 7299000, stock: 5, category: 'gaming', image_url: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400', description: 'Konsol Sony generasi terbaru' },
  { id: 6, name: 'Nike Air Max 90', price: 1899000, stock: 25, category: 'fashion', image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', description: 'Sneakers klasik Nike' },
  { id: 7, name: 'Mechanical Keyboard RGB', price: 899000, stock: 40, category: 'electronics', image_url: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=400', description: 'Keyboard mekanik gaming' },
  { id: 8, name: 'Levi\'s 501 Original', price: 1299000, stock: 35, category: 'fashion', image_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400', description: 'Jeans klasik Levi\'s' },
  { id: 9, name: 'Canon EOS R50', price: 12999000, stock: 8, category: 'electronics', image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400', description: 'Mirrorless camera Canon' },
  { id: 10, name: 'Dyson V15 Detect', price: 8999000, stock: 12, category: 'home', image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400', description: 'Vacuum cleaner cordless Dyson' },
  { id: 11, name: 'MacBook Air M3', price: 21999000, stock: 7, category: 'electronics', image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400', description: 'Laptop ringan Apple M3' },
  { id: 12, name: 'Adidas Ultraboost', price: 2799000, stock: 18, category: 'fashion', image_url: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400', description: 'Running shoes Adidas' },
  { id: 13, name: 'Xiaomi Robot Vacuum', price: 4999000, stock: 22, category: 'home', image_url: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=400', description: 'Robot vacuum Xiaomi' },
]

const mockFlashProducts = [
  { ...mockProducts[0], flash_sale_price: 14999000, flash_sale_stock: 5, flash_sale_start: '2026-08-01T00:00:00.000Z', flash_sale_end: '2026-12-31T23:59:59.000Z', is_flash_sale: true },
  { ...mockProducts[4], flash_sale_price: 5999000, flash_sale_stock: 3, flash_sale_start: '2026-08-01T00:00:00.000Z', flash_sale_end: '2026-12-31T23:59:59.000Z', is_flash_sale: true },
]

const mockCart = {
  id: 1,
  items: [
    { id: 1, product_id: 1, name: 'Laptop ASUS ROG', price: 18500000, quantity: 1, image_url: mockProducts[0].image_url },
    { id: 2, product_id: 3, name: 'Samsung Galaxy S24', price: 16500000, quantity: 2, image_url: mockProducts[2].image_url },
  ],
}

const mockOrders = [
  {
    id: 1001,
    user_id: 1,
    status: 'COMPLETED',
    total: 51499000,
    created_at: '2026-08-03T10:00:00.000Z',
    items: [
      { id: 1, product_id: 1, name: 'Laptop ASUS ROG', price: 18500000, quantity: 1 },
      { id: 2, product_id: 2, name: 'iPhone 15 Pro', price: 19999000, quantity: 1 },
      { id: 3, product_id: 4, name: 'AirPods Pro 2', price: 3499000, quantity: 1 },
    ],
  },
  {
    id: 1002,
    user_id: 1,
    status: 'PENDING',
    total: 7299000,
    created_at: '2026-08-04T14:30:00.000Z',
    items: [
      { id: 4, product_id: 5, name: 'PlayStation 5', price: 7299000, quantity: 1 },
    ],
  },
]

const mockProfile = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'USER',
  phone: '+628123456789',
  address: 'Jl. Sudirman No. 123',
  city: 'Jakarta',
  province: 'DKI Jakarta',
  postal_code: '10220',
  created_at: '2026-08-01T00:00:00.000Z',
}

const mockDashboard = {
  totalUsers: 150,
  totalProducts: 13,
  ordersToday: 25,
  flashSaleActive: 1,
  recentOrders: [
    { id: 1001, user_name: 'Test User', total: 51499000, status: 'COMPLETED', created_at: '2026-08-03T10:00:00.000Z' },
    { id: 1002, user_name: 'Another User', total: 7299000, status: 'PENDING', created_at: '2026-08-04T14:30:00.000Z' },
  ],
}

/* ------------------------------------------------------------------ */
/*  Handlers                                                           */
/* ------------------------------------------------------------------ */

export const handlers = [
  // --- Auth ---
  http.get('/api/auth/me', () => {
    return HttpResponse.json({ success: true, message: 'User found', data: { user: mockUser } })
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    if (!body.email || !body.password) {
      return HttpResponse.json(
        { success: false, message: 'Email and password are required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (body.password === 'wrongpassword') {
      return HttpResponse.json(
        { success: false, message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      )
    }
    return HttpResponse.json({ success: true, message: 'Login successful', data: { user: mockUser, token: 'mock-jwt-token' } })
  }),

  http.post('/api/auth/signup', async ({ request }) => {
    const body = await request.json() as { name: string; email: string; password: string }
    if (!body.name || !body.email || !body.password) {
      return HttpResponse.json(
        { success: false, message: 'All fields are required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (body.email === 'existing@example.com') {
      return HttpResponse.json(
        { success: false, message: 'Email already registered', code: 'EMAIL_ALREADY_REGISTERED' },
        { status: 409 }
      )
    }
    return HttpResponse.json({ success: true, message: 'Signup successful', data: { user: { ...mockUser, name: body.name, email: body.email } } })
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true, message: 'Logged out' })
  }),

  // --- Products ---
  http.get('/api/products', ({ request }) => {
    const url = new URL(request.url)
    const category = url.searchParams.get('category')
    const search = url.searchParams.get('search')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '12')

    let filtered = [...mockProducts]
    if (category && category !== 'all') {
      filtered = filtered.filter(p => p.category === category)
    }
    if (search) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    }

    const total = filtered.length
    const start = (page - 1) * limit
    const products = filtered.slice(start, start + limit)

    return HttpResponse.json({
      success: true,
      message: 'Products retrieved',
      data: { products, total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  }),

  http.get('/api/products/:id', ({ params }) => {
    const id = parseInt(params.id as string)
    const product = mockProducts.find(p => p.id === id)
    if (!product) {
      return HttpResponse.json(
        { success: false, message: 'Product not found', code: 'PRODUCT_NOT_FOUND' },
        { status: 404 }
      )
    }
    return HttpResponse.json({ success: true, message: 'Product retrieved', data: product })
  }),

  // --- Cart ---
  http.get('/api/cart', () => {
    return HttpResponse.json({ success: true, message: 'Cart retrieved', data: mockCart })
  }),

  http.post('/api/cart/items', async ({ request }) => {
    const body = await request.json() as { productId: number; quantity: number }
    return HttpResponse.json({
      success: true,
      message: 'Item added to cart',
      data: { id: Date.now(), product_id: body.productId, quantity: body.quantity || 1 },
    })
  }),

  http.patch('/api/cart/items/:id', async ({ request }) => {
    const body = await request.json() as { quantity: number }
    return HttpResponse.json({
      success: true,
      message: 'Cart item updated',
      data: { id: parseInt(params.id as string), quantity: body.quantity },
    })
  }),

  http.delete('/api/cart/items/:id', () => {
    return HttpResponse.json({ success: true, message: 'Item removed from cart' })
  }),

  http.post('/api/cart/merge', () => {
    return HttpResponse.json({ success: true, message: 'Cart merged' })
  }),

  // --- Flash Sale ---
  http.get('/api/flashsale/active', () => {
    return HttpResponse.json({ success: true, message: 'Flash sale products retrieved', data: mockFlashProducts })
  }),

  http.post('/api/flashsale/checkout', async ({ request }) => {
    const body = await request.json() as { productId: number; quantity: number }
    const flashProduct = mockFlashProducts.find(p => p.id === body.productId)
    if (!flashProduct) {
      return HttpResponse.json(
        { success: false, message: 'Product not found in flash sale', code: 'PRODUCT_NOT_FOUND' },
        { status: 404 }
      )
    }
    if (body.quantity > flashProduct.flash_sale_stock!) {
      return HttpResponse.json(
        { success: false, message: 'Out of stock', code: 'OUT_OF_STOCK' },
        { status: 400 }
      )
    }
    return HttpResponse.json({
      success: true,
      message: 'Checkout successful',
      data: { orderId: 2001, total: flashProduct.flash_sale_price! * body.quantity },
    })
  }),

  // --- Admin Flash Sale ---
  http.post('/api/admin/flashsale/items', () => {
    return HttpResponse.json({ success: true, message: 'Flash sale item set' })
  }),

  http.delete('/api/admin/flashsale/items/:id', () => {
    return HttpResponse.json({ success: true, message: 'Flash sale item removed' })
  }),

  http.post('/api/admin/flashsale/warmup', () => {
    return HttpResponse.json({ success: true, message: 'Cache warmed up' })
  }),

  http.post('/api/admin/flashsale/start', () => {
    return HttpResponse.json({ success: true, message: 'Flash sale started' })
  }),

  // --- Orders ---
  http.get('/api/orders', ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')

    return HttpResponse.json({
      success: true,
      message: 'Orders retrieved',
      data: { orders: mockOrders, total: mockOrders.length, page, limit },
    })
  }),

  http.get('/api/orders/:id', ({ params }) => {
    const id = parseInt(params.id as string)
    const order = mockOrders.find(o => o.id === id)
    if (!order) {
      return HttpResponse.json(
        { success: false, message: 'Order not found', code: 'ORDER_NOT_FOUND' },
        { status: 404 }
      )
    }
    return HttpResponse.json({ success: true, message: 'Order retrieved', data: order })
  }),

  // --- Profile ---
  http.get('/api/profile', () => {
    return HttpResponse.json({ success: true, data: mockProfile })
  }),

  http.put('/api/profile', async ({ request }) => {
    const body = await request.json() as Record<string, string>
    return HttpResponse.json({ success: true, data: { ...mockProfile, ...body } })
  }),

  http.put('/api/profile/password', async ({ request }) => {
    const body = await request.json() as { currentPassword: string; newPassword: string }
    if (body.currentPassword === 'wrongpassword') {
      return HttpResponse.json(
        { success: false, message: 'Current password is incorrect', code: 'INVALID_PASSWORD' },
        { status: 400 }
      )
    }
    return HttpResponse.json({ success: true, message: 'Password changed successfully' })
  }),

  // --- Admin Dashboard ---
  http.get('/api/admin/dashboard', () => {
    return HttpResponse.json({ success: true, message: 'Dashboard data retrieved', data: mockDashboard })
  }),
]
