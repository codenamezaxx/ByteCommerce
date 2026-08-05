import '../setupTests'
import { render } from '@testing-library/react'
import SignupPage from '@/app/auth/signup/page'

// Mock next/navigation redirect
const mockRedirect = jest.fn()
jest.mock('next/navigation', () => ({
  redirect: (...args: any[]) => mockRedirect(...args),
}))

describe('SignupPage', () => {
  beforeEach(() => {
    mockRedirect.mockClear()
  })

  it('redirects to /auth/login on mount', () => {
    render(<SignupPage />)
    expect(mockRedirect).toHaveBeenCalledWith('/auth/login')
  })
})
