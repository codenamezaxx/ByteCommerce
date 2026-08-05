import '../setupTests'
import { render, screen, waitFor } from '@testing-library/react'
import AdminPage from '@/app/admin/page'

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

// Mock PhantomSkeleton to render children directly
jest.mock('@/components/PhantomSkeleton', () => {
  return function MockPhantomSkeleton({ children }: any) {
    return <div>{children}</div>
  }
})

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Users: (props: any) => <svg data-testid="icon-users" {...props} />,
  Package: (props: any) => <svg data-testid="icon-package" {...props} />,
  ShoppingCart: (props: any) => <svg data-testid="icon-cart" {...props} />,
  Zap: (props: any) => <svg data-testid="icon-zap" {...props} />,
  TrendingUp: (props: any) => <svg data-testid="icon-trending" {...props} />,
}))

describe('AdminPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, name: 'Admin', role: 'admin' },
      loading: false,
    })
    mockPush.mockClear()
  })

  it('renders dashboard header', async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('Dashboard Admin')).toBeInTheDocument()
    })
  })

  it('renders dashboard metrics from MSW handler', async () => {
    render(<AdminPage />)
    await waitFor(() => {
      // MSW handler returns: totalUsers: 150, totalProducts: 13, ordersToday: 25, flashSaleActive: 1
      expect(screen.getByText('150')).toBeInTheDocument()
      expect(screen.getByText('13')).toBeInTheDocument()
      expect(screen.getByText('25')).toBeInTheDocument()
    })
  })

  it('renders recent orders from MSW handler', async () => {
    render(<AdminPage />)
    await waitFor(() => {
      // MSW handler returns orders with user_name 'Test User' and 'Another User'
      expect(screen.getByText('1001')).toBeInTheDocument()
      expect(screen.getByText('1002')).toBeInTheDocument()
    })
  })

  it('renders quick action links', async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('Manajemen Produk')).toBeInTheDocument()
      expect(screen.getByText('Flash Sale Control')).toBeInTheDocument()
    })
  })

  it('redirects non-admin users to home', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, name: 'Customer', role: 'customer' },
      loading: false,
    })
    render(<AdminPage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('redirects unauthenticated users to home', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    render(<AdminPage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('shows welcome message with admin name', async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText(/Selamat datang/)).toBeInTheDocument()
    })
  })
})
