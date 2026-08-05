import '../setupTests'
import { render, screen } from '@testing-library/react'
import Spinner, { PageSpinner } from '@/components/Spinner'

describe('Spinner', () => {
  it('renders with default size', () => {
    render(<Spinner />)
    const wrapper = document.querySelector('.spinner-lg')
    expect(wrapper).toBeInTheDocument()
  })

  it('renders with sm size', () => {
    const { container } = render(<Spinner size="sm" />)
    const outer = container.firstChild as HTMLElement
    expect(outer.style.width).toBe('1rem')
  })

  it('renders with lg size', () => {
    const { container } = render(<Spinner size="lg" />)
    const outer = container.firstChild as HTMLElement
    expect(outer.style.width).toBe('2rem')
  })
})

describe('PageSpinner', () => {
  it('renders centered loading indicator', () => {
    render(<PageSpinner />)
    const wrapper = document.querySelector('.spinner-lg')
    expect(wrapper).toBeInTheDocument()
  })
})
