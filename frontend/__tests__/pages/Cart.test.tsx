import '../setupTests'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CartPage from '@/app/cart/page'

// Mock AuthContext
const mockUseAuth = jest.fn()
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}))

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>
  }
})

// Mock PhantomSkeleton
jest.mock('@/components/PhantomSkeleton', () => {
  return function MockPhantomSkeleton({ children }: any) {
    return <div>{children}</div>
  }
})

// Mock ProductImage
jest.mock('@/components/ProductImage', () => {
  return function MockProductImage({ alt }: any) {
    return <div data-testid="product-image">{alt}</div>
  }
})

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Trash2: (props: any) => <svg data-testid="icon-trash" {...props} />,
  Plus: (props: any) => <svg data-testid="icon-plus" {...props} />,
  Minus: (props: any) => <svg data-testid="icon-minus" {...props} />,
  ShoppingCart: (props: any) => <svg data-testid="icon-cart" {...props} />,
  ArrowLeft: (props: any) => <svg data-testid="icon-arrow-left" {...props} />,
}))

describe('CartPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, name: 'Test User', role: 'customer' },
      loading: false,
    })
  })

  it('renders cart page header', async () => {
    render(<CartPage />)
    await waitFor(() => {
      expect(screen.getByText(/Keranjang/i)).toBeInTheDocument()
    })
  })

  it('shows cart items from MSW handler', async () => {
    render(<CartPage />)
    await waitFor(() => {
      // MSW handler returns 2 items: Laptop ASUS ROG and Samsung Galaxy S24
      // Each name appears twice (ProductImage mock div + h4), so use getAllByText
      expect(screen.getAllByText('Laptop ASUS ROG').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Samsung Galaxy S24').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows product images for cart items', async () => {
    render(<CartPage />)
    await waitFor(() => {
      expect(screen.getAllByTestId('product-image').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows quantity controls', async () => {
    render(<CartPage />)
    await waitFor(() => {
      expect(screen.getAllByLabelText('Kurangi jumlah').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByLabelText('Tambah jumlah').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows remove buttons for each item', async () => {
    render(<CartPage />)
    await waitFor(() => {
      expect(screen.getAllByLabelText('Hapus item').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows checkout button when cart has items', async () => {
    render(<CartPage />)
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Lanjut ke Checkout/ })).toBeInTheDocument()
    })
  })
})
