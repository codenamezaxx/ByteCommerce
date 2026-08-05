import '../setupTests'
import { render, screen } from '@testing-library/react'
import ProductImage from '@/components/ProductImage'

// Mock lucide-react Image icon
jest.mock('lucide-react', () => ({
  Image: (props: any) => <svg data-testid="icon-image" {...props} />,
}))

describe('ProductImage', () => {
  it('renders image with correct src and alt', () => {
    render(<ProductImage src="/test.jpg" alt="Test product" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/test.jpg')
    expect(img).toHaveAttribute('alt', 'Test product')
  })

  it('shows fallback placeholder when src is null', () => {
    render(<ProductImage src={null} alt="No image" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('icon-image')).toBeInTheDocument()
  })

  it('shows fallback placeholder when src is undefined', () => {
    render(<ProductImage alt="No image" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('icon-image')).toBeInTheDocument()
  })

  it('applies className when provided', () => {
    render(<ProductImage src="/test.jpg" alt="Product" className="custom-class" />)
    const img = screen.getByRole('img')
    expect(img).toHaveClass('ph-img-inner')
  })
})
