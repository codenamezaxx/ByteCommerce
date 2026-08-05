// ByteCommerce API Client
// Attaches X-Guest-ID from localStorage, parses errors, throws with code

export class ApiError extends Error {
  code: string;
  status: number;
  errors?: string[];

  constructor(message: string, status: number, code: string, errors?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.errors = errors;
  }
}

function getGuestId(): string {
  if (typeof window === 'undefined') return '';
  let guestId = localStorage.getItem('guest_id');
  if (!guestId) {
    guestId = crypto.randomUUID();
    localStorage.setItem('guest_id', guestId);
  }
  return guestId;
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Build URL with query params
  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  // Attach headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  const guestId = getGuestId();
  if (guestId) {
    headers['X-Guest-ID'] = guestId;
  }

  const res = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: 'include', // send httpOnly cookie
  });

  // Handle non-JSON responses
  const contentType = res.headers.get('content-type');
  let body: any;
  if (contentType && contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  if (!res.ok) {
    const message = typeof body === 'object' && body?.message ? body.message : 'Terjadi kesalahan';
    const code = typeof body === 'object' && body?.code ? body.code : 'UNKNOWN_ERROR';
    const errors = typeof body === 'object' && body?.errors ? body.errors : undefined;
    throw new ApiError(message, res.status, code, errors);
  }

  return body as T;
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: (name: string, email: string, password: string) =>
    request('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  logout: () =>
    request('/api/auth/logout', { method: 'POST' }),
  me: () =>
    request('/api/auth/me'),
};

// Products
export const productsApi = {
  list: (params?: Record<string, string | number | undefined>) =>
    request('/api/products', { params }),
  get: (id: string | number) =>
    request(`/api/products/${id}`),
};

// Cart
export const cartApi = {
  get: () => request('/api/cart'),
  addItem: (product_id: number, quantity: number = 1) =>
    request('/api/cart/items', { method: 'POST', body: JSON.stringify({ productId: product_id, quantity }) }),
  updateItem: (id: number, quantity: number) =>
    request(`/api/cart/items/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
  removeItem: (id: number) =>
    request(`/api/cart/items/${id}`, { method: 'DELETE' }),
  merge: () =>
    request('/api/cart/merge', { method: 'POST' }),
};

// Flash Sale
export const flashsaleApi = {
  active: () => request('/api/flashsale/active'),
  checkout: (
    product_id: number,
    quantity: number = 1,
    shipping?: { name: string; phone: string; address: string; city: string; province: string; postalCode: string; note?: string },
    paymentMethod?: string,
  ) =>
    request('/api/flashsale/checkout', {
      method: 'POST',
      body: JSON.stringify({
        productId: product_id,
        quantity,
        ...(shipping ? { shipping } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
      }),
    }),
  setItem: (productId: number, flashSalePrice: number, flashSaleStock: number, startAt?: string | null, endAt?: string | null) =>
    request('/api/admin/flashsale/items', {
      method: 'POST',
      body: JSON.stringify({
        productId,
        flashSalePrice,
        flashSaleStock,
        ...(startAt ? { startAt } : {}),
        ...(endAt ? { endAt } : {}),
      }),
    }),
  removeItem: (productId: number) =>
    request(`/api/admin/flashsale/items/${productId}`, { method: 'DELETE' }),
};

// Orders
export const ordersApi = {
  list: (params?: Record<string, string | number | undefined>) =>
    request('/api/orders', { params }),
  get: (id: string | number) =>
    request(`/api/orders/${id}`),
  checkout: (
    productIds: number[],
    shipping: { name: string; phone: string; address: string; city: string; province: string; postalCode: string; note?: string },
    paymentMethod: string,
  ) =>
    request('/api/orders/checkout', {
      method: 'POST',
      body: JSON.stringify({ productIds, shipping, paymentMethod }),
    }),
};

// User Profile
export interface Profile {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  created_at: string;
}

export const profileApi = {
  get: () => request<{ success: boolean; data: Profile }>('/api/profile'),
  update: (data: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  }) =>
    request<{ success: boolean; data: Profile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/api/profile/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

// Admin
export const adminApi = {
  dashboard: () => request('/api/admin/dashboard'),
  flashsaleWarmup: () =>
    request('/api/admin/flashsale/warmup', { method: 'POST' }),
  flashsaleStart: (durationMinutes: number) =>
    request('/api/admin/flashsale/start', {
      method: 'POST',
      body: JSON.stringify({ durationMinutes }),
    }),
  flashsaleKillswitch: () =>
    request('/api/admin/flashsale/killswitch', { method: 'POST' }),

  // Image upload — uses raw fetch (NOT request()) to avoid Content-Type: application/json
  uploadImage: async (productId: number, file: File): Promise<{ image_url: string }> => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`/api/admin/products/${productId}/image`, {
      method: 'POST',
      credentials: 'include',
      body: fd,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = body?.message || 'Gagal upload gambar';
      throw new ApiError(message, res.status, body?.code || 'UPLOAD_ERROR', body?.errors);
    }
    return body?.data || body;
  },

  // Image delete — uses raw fetch for consistency
  deleteImage: async (productId: number): Promise<{ image_url: null }> => {
    const res = await fetch(`/api/admin/products/${productId}/image`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = body?.message || 'Gagal menghapus gambar';
      throw new ApiError(message, res.status, body?.code || 'DELETE_ERROR', body?.errors);
    }
    return body?.data || body;
  },
};
