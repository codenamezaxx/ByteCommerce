import '../setupTests'
import { render, screen } from '@testing-library/react'
import Footer from '@/components/Footer'

describe('Footer', () => {
  it('renders copyright text', () => {
    render(<Footer />)
    expect(screen.getByText(/© 2026 ByteCommerce/)).toBeInTheDocument()
  })

  it('renders powered-by text', () => {
    render(<Footer />)
    expect(screen.getByText('Powered by Flash Sale Engine')).toBeInTheDocument()
  })

  it('renders footer element with correct class', () => {
    const { container } = render(<Footer />)
    const footer = container.querySelector('footer.footer')
    expect(footer).toBeInTheDocument()
  })
})
