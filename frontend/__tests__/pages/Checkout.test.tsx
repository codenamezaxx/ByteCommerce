import '../setupTests'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CheckoutPage from '@/app/checkout/page'

// Mock AuthContext
const mockUseAuth = jest.fn()
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn() }),
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

// Mock InvoiceCard
jest.mock('@/components/InvoiceCard', () => {
  return function MockInvoiceCard({ items, total }: any) {
    return <div data-testid="invoice-card">Invoice: {total}</div>
  }
})

// Mock lucide-react
jest.mock('lucide-react', () => ({
  CreditCard: (props: any) => <svg data-testid="icon-credit-card" {...props} />,
  Banknote: (props: any) => <svg data-testid="icon-banknote" {...props} />,
  QrCode: (props: any) => <svg data-testid="icon-qr-code" {...props} />,
  CheckCircle: (props: any) => <svg data-testid="icon-check-circle" {...props} />,
}))

describe('CheckoutPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, name: 'Test User', role: 'customer' },
      loading: false,
    })
    mockPush.mockClear()
  })

  it('renders checkout page header', async () => {
    render(<CheckoutPage />)
    await waitFor(() => {
      expect(screen.getByText(/Checkout/i)).toBeInTheDocument()
    })
  })

  it('renders shipping form fields', async () => {
    render(<CheckoutPage />)
    await waitFor(() => {
      expect(screen.getByLabelText(/Nama Lengkap/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/No\. HP/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Alamat/i)).toBeInTheDocument()
    })
  })

  it('renders payment method options', async () => {
    render(<CheckoutPage />)
    await waitFor(() => {
      expect(screen.getByText(/Transfer Bank/i)).toBeInTheDocument()
      expect(screen.getByText(/COD/i)).toBeInTheDocument()
      expect(screen.getByText(/QRIS/i)).toBeInTheDocument()
    })
  })

  it('loads cart items for checkout', async () => {
    render(<CheckoutPage />)
    await waitFor(() => {
      // MSW handler returns cart items
      expect(screen.getByText('Laptop ASUS ROG')).toBeInTheDocument()
    })
  })
})
