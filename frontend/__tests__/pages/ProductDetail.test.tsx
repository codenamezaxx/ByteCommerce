import '../setupTests'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductDetailPage from '@/app/products/[id]/page'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn() }),
  useParams: () => ({ id: '1' }),
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
  return function MockProductImage({ src, alt }: any) {
    return <img data-testid="product-image" src={src} alt={alt} />
  }
})

// Mock CountdownTimer
jest.mock('@/components/CountdownTimer', () => {
  return function MockCountdownTimer() {
    return <div data-testid="countdown-timer">Countdown</div>
  }
})

// Mock lucide-react
jest.mock('lucide-react', () => ({
  ShoppingCart: (props: any) => <svg data-testid="icon-cart" {...props} />,
  ArrowLeft: (props: any) => <svg data-testid="icon-arrow-left" {...props} />,
  Star: (props: any) => <svg data-testid="icon-star" {...props} />,
  Package: (props: any) => <svg data-testid="icon-package" {...props} />,
}))

describe('ProductDetailPage', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('renders product details from MSW handler', async () => {
    render(<ProductDetailPage />)
    await waitFor(() => {
      // Product id=1 from MSW: Laptop ASUS ROG
      expect(screen.getByRole('heading', { name: 'Laptop ASUS ROG' })).toBeInTheDocument()
      expect(screen.getByText(/18.500.000/)).toBeInTheDocument()
    })
  })

  it('renders buy flash sale button', async () => {
    render(<ProductDetailPage />)
    await waitFor(() => {
      expect(screen.getByText(/Beli Flash Sale/i)).toBeInTheDocument()
    })
  })

  it('renders product image', async () => {
    render(<ProductDetailPage />)
    await waitFor(() => {
      expect(screen.getByTestId('product-image')).toBeInTheDocument()
    })
  })

  it('shows product description', async () => {
    render(<ProductDetailPage />)
    await waitFor(() => {
      expect(screen.getByText(/Laptop gaming performa tinggi/)).toBeInTheDocument()
    })
  })

  it('shows breadcrumb navigation', async () => {
    render(<ProductDetailPage />)
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Produk')).toBeInTheDocument()
    })
  })
})
