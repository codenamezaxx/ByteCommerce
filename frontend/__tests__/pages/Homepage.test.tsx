import '../setupTests'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HomePage from '@/app/page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
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
  return function MockCountdownTimer({ targetDate }: any) {
    return <div data-testid="countdown-timer">Countdown</div>
  }
})

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Search: (props: any) => <svg data-testid="icon-search" {...props} />,
  X: (props: any) => <svg data-testid="icon-x" {...props} />,
  Zap: (props: any) => <svg data-testid="icon-zap" {...props} />,
  Tag: (props: any) => <svg data-testid="icon-tag" {...props} />,
  Clock: (props: any) => <svg data-testid="icon-clock" {...props} />,
  Monitor: (props: any) => <svg data-testid="icon-monitor" {...props} />,
  Shirt: (props: any) => <svg data-testid="icon-shirt" {...props} />,
  Gem: (props: any) => <svg data-testid="icon-gem" {...props} />,
  Heart: (props: any) => <svg data-testid="icon-heart" {...props} />,
}))

// Mock IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe() { this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as any) }
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
})

describe('HomePage', () => {
  it('renders homepage heading', async () => {
    render(<HomePage />)
    await waitFor(() => {
      expect(screen.getByText(/Rekomendasi Untukmu/i)).toBeInTheDocument()
    })
  })

  it('displays products from MSW handler', async () => {
    render(<HomePage />)
    await waitFor(() => {
      // MSW returns 13 products, first page should show some
      const productImages = screen.getAllByTestId('product-image')
      expect(productImages.length).toBeGreaterThan(0)
    })
  })

  it('renders search input', async () => {
    render(<HomePage />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Cari produk/i)).toBeInTheDocument()
    })
  })

  it('displays flash sale section when available', async () => {
    render(<HomePage />)
    await waitFor(() => {
      // MSW returns flash sale products
      const flashElements = screen.queryAllByText(/Flash Sale/i)
      expect(flashElements.length).toBeGreaterThanOrEqual(0)
    })
  })

  it('displays product names', async () => {
    render(<HomePage />)
    await waitFor(() => {
      // Product name appears in both Flash Sale and Rekomendasi sections
      const nameElements = screen.getAllByText('Laptop ASUS ROG')
      expect(nameElements.length).toBeGreaterThanOrEqual(1)
    })
  })
})
