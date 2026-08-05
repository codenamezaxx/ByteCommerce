import '../setupTests'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthPage from '@/app/auth/login/page'

// Mock AuthContext
const mockLogin = jest.fn()
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, user: null, loading: false, logout: jest.fn(), signup: jest.fn() }),
}))

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
}))

// Mock lucide-react
jest.mock('lucide-react', () => ({
  CircleX: (props: any) => <svg data-testid="icon-circle-x" {...props} />,
}))

describe('LoginPage', () => {
  beforeEach(() => {
    mockLogin.mockClear()
    mockPush.mockClear()
  })

  // The submit button is the only <button type="submit">; the "Masuk" tab
  // button also matches by name, so disambiguate by type.
  const submitButton = () =>
    screen.getAllByRole('button', { name: /Masuk/ }).find((b) => b.getAttribute('type') === 'submit')!

  it('renders login form by default', async () => {
    render(<AuthPage />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText(/Kata Sandi/)).toBeInTheDocument()
    expect(submitButton()).toBeInTheDocument()
  })

  it('shows error when submitting empty form', async () => {
    const user = userEvent.setup()
    render(<AuthPage />)
    await user.click(submitButton())
    expect(screen.getByText('Email dan password wajib diisi')).toBeInTheDocument()
  })

  it('calls login and navigates on success', async () => {
    mockLogin.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<AuthPage />)
    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText(/Kata Sandi/), 'password123')
    await user.click(submitButton())
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'))
    const user = userEvent.setup()
    render(<AuthPage />)
    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText(/Kata Sandi/), 'password123')
    await user.click(submitButton())
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('can switch to signup tab', async () => {
    const user = userEvent.setup()
    render(<AuthPage />)
    // The "Daftar" tab button is the first matching button in the DOM
    // (the footer "Daftar" link also matches by name).
    await user.click(screen.getAllByRole('button', { name: 'Daftar' })[0])
    expect(screen.getByLabelText('Nama Lengkap')).toBeInTheDocument()
    expect(screen.getByLabelText('Konfirmasi Password')).toBeInTheDocument()
  })
})
