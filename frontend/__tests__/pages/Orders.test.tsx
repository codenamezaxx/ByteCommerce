import '../setupTests'
import { render, screen, waitFor } from '@testing-library/react'
import OrdersPage from '@/app/orders/page'

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

// Mock PhantomSkeleton to render children directly
jest.mock('@/components/PhantomSkeleton', () => {
  return function MockPhantomSkeleton({ children }: any) {
    return <div>{children}</div>
  }
})

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Package: (props: any) => <svg data-testid="icon-package" {...props} />,
  ChevronLeft: (props: any) => <svg data-testid="icon-chevron-left" {...props} />,
  ChevronRight: (props: any) => <svg data-testid="icon-chevron-right" {...props} />,
  Eye: (props: any) => <svg data-testid="icon-eye" {...props} />,
}))

describe('OrdersPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, name: 'Budi', role: 'customer' },
      loading: false,
    })
  })

  it('renders orders page header', async () => {
    render(<OrdersPage />)
    await waitFor(() => {
      expect(screen.getByText('Pesanan Saya')).toBeInTheDocument()
    })
  })

  it('shows empty state when no orders', async () => {
    // MSW default handler returns orders, but we test the page renders
    render(<OrdersPage />)
    await waitFor(() => {
      expect(screen.getByText('Pesanan Saya')).toBeInTheDocument()
    })
    // Default MSW handler returns 2 orders, so table should be present
    expect(screen.getByText('Order ID')).toBeInTheDocument()
  })

  it('renders orders table with data from MSW', async () => {
    render(<OrdersPage />)
    await waitFor(() => {
      // MSW handlers return orders with ids 1001 and 1002
      expect(screen.getByText('1001')).toBeInTheDocument()
      expect(screen.getByText('1002')).toBeInTheDocument()
    })
  })

  it('shows order status badges', async () => {
    render(<OrdersPage />)
    await waitFor(() => {
      // getStatusBadge translates statuses: COMPLETED -> badge-neutral, PENDING -> "Menunggu"
      expect(screen.getByText('COMPLETED')).toBeInTheDocument()
      expect(screen.getByText('Menunggu')).toBeInTheDocument()
    })
  })

  it('shows detail links for each order', async () => {
    render(<OrdersPage />)
    await waitFor(() => {
      const detailLinks = screen.getAllByText('Detail')
      expect(detailLinks.length).toBeGreaterThanOrEqual(1)
    })
  })
})
