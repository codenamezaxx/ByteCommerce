import '../setupTests'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfilePage from '@/app/profile/page'

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

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Eye: (props: any) => <svg data-testid="icon-eye" {...props} />,
  EyeOff: (props: any) => <svg data-testid="icon-eye-off" {...props} />,
  CheckCircle2: (props: any) => <svg data-testid="icon-check-circle" {...props} />,
  Circle: (props: any) => <svg data-testid="icon-circle" {...props} />,
  Check: (props: any) => <svg data-testid="icon-check" {...props} />,
  CircleX: (props: any) => <svg data-testid="icon-circle-x" {...props} />,
}))

describe('ProfilePage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, name: 'Test User', email: 'test@example.com', role: 'USER' },
      loading: false,
    })
  })

  it('renders profile page header', async () => {
    render(<ProfilePage />)
    await waitFor(() => {
      expect(screen.getByText(/Profil Saya/i)).toBeInTheDocument()
    })
  })

  it('shows profile tab by default', async () => {
    render(<ProfilePage />)
    await waitFor(() => {
      // "Test User" is in the form input value, not text content
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    })
  })

  it('renders tab navigation buttons', async () => {
    render(<ProfilePage />)
    await waitFor(() => {
      // Tab buttons use role="tab" (ARIA tablist)
      expect(screen.getByRole('tab', { name: /Profil/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Keamanan/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Alamat/i })).toBeInTheDocument()
    })
  })

  it('loads and displays profile data', async () => {
    render(<ProfilePage />)
    await waitFor(() => {
      // Profile data loaded from MSW handler
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
    })
  })
})
