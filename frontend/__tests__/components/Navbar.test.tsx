import '../setupTests'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Navbar from '@/components/Navbar'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
}))

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>
  }
})

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Sun: (props: any) => <svg data-testid="icon-sun" {...props} />,
  Moon: (props: any) => <svg data-testid="icon-moon" {...props} />,
  User: (props: any) => <svg data-testid="icon-user" {...props} />,
  ChevronDown: (props: any) => <svg data-testid="icon-chevron" {...props} />,
  ShoppingCart: (props: any) => <svg data-testid="icon-cart" {...props} />,
  LogOut: (props: any) => <svg data-testid="icon-logout" {...props} />,
  Menu: (props: any) => <svg data-testid="icon-menu" {...props} />,
  X: (props: any) => <svg data-testid="icon-x" {...props} />,
}))

// Mock AuthContext
const mockUseAuth = jest.fn()
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// Mock cart API
jest.mock('@/lib/api', () => ({
  cartApi: { get: jest.fn().mockResolvedValue({ data: { items: [] } }), merge: jest.fn() },
}))

// Mock categories
jest.mock('@/lib/categories', () => ({
  CATEGORIES: [{ label: 'Elektronik' }, { label: 'Fashion' }],
}))

describe('Navbar', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, logout: jest.fn() })
  })

  it('renders brand link and navigation links', () => {
    render(<Navbar />)
    // Navbar has aria-label="ByteCommerce" on the <a> and on the <svg role="img>
    const brands = screen.getAllByLabelText('ByteCommerce')
    expect(brands.length).toBeGreaterThanOrEqual(1)
    // Desktop + mobile both render, so use getAllByText
    expect(screen.getAllByText('Beranda').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Flash Sale').length).toBeGreaterThanOrEqual(1)
  })

  it('shows login and signup links when logged out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, logout: jest.fn() })
    render(<Navbar />)
    // Desktop + mobile both render login/signup
    expect(screen.getAllByText('Masuk').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Daftar').length).toBeGreaterThanOrEqual(1)
  })

  it('shows user dropdown when logged in', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, name: 'Budi', email: 'budi@test.com', role: 'customer' },
      loading: false,
      logout: jest.fn(),
    })
    render(<Navbar />)
    expect(screen.getByLabelText('Menu pengguna')).toBeInTheDocument()
    expect(screen.queryByText('Masuk')).not.toBeInTheDocument()
  })
})
