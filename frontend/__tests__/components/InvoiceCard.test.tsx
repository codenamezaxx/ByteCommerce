import '../setupTests'
import { render, screen } from '@testing-library/react'
import InvoiceCard from '@/components/InvoiceCard'

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Check: (props: any) => <svg data-testid="icon-check" {...props} />,
  Clock: (props: any) => <svg data-testid="icon-clock" {...props} />,
  CreditCard: (props: any) => <svg data-testid="icon-credit-card" {...props} />,
  Copy: (props: any) => <svg data-testid="icon-copy" {...props} />,
}))

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>
  }
})

const mockOrder = {
  id: 1,
  total_amount: 150000,
  status: 'PENDING',
  created_at: '2026-08-05T10:00:00Z',
  shipping_name: 'Budi Santoso',
  shipping_address: 'Jl. Sudirman 123',
  shipping_city: 'Jakarta',
  shipping_province: 'DKI Jakarta',
  shipping_postal_code: '12345',
  shipping_phone: '081234567890',
  payment_method: 'BANK_TRANSFER',
  items: [
    { product_name: 'Laptop ASUS', quantity: 1, price_at_purchase: 100000 },
    { product_name: 'Mouse Logitech', quantity: 2, price_at_purchase: 25000 },
  ],
}

describe('InvoiceCard', () => {
  it('renders order info with pending status', () => {
    render(<InvoiceCard order={mockOrder} />)
    expect(screen.getByText('Pesanan Dibuat')).toBeInTheDocument()
    expect(screen.getByText(/MENUNGGU PEMBAYARAN/)).toBeInTheDocument()
    expect(screen.getByTestId('icon-clock')).toBeInTheDocument()
  })

  it('renders items list with correct quantities', () => {
    render(<InvoiceCard order={mockOrder} />)
    expect(screen.getByText(/Laptop ASUS/)).toBeInTheDocument()
    expect(screen.getByText(/Mouse Logitech/)).toBeInTheDocument()
  })

  it('renders paid status with success icon', () => {
    const paidOrder = { ...mockOrder, status: 'PAID' }
    render(<InvoiceCard order={paidOrder} />)
    expect(screen.getByText('Pesanan Berhasil!')).toBeInTheDocument()
    expect(screen.getByText(/Lunas/)).toBeInTheDocument()
    expect(screen.getByTestId('icon-check')).toBeInTheDocument()
  })
})
