import '../setupTests'
import { render, screen } from '@testing-library/react'
import PhantomSkeleton from '@/components/PhantomSkeleton'

describe('PhantomSkeleton', () => {
  it('renders children inside phantom-ui element', () => {
    const { container } = render(
      <PhantomSkeleton loading={true}>
        <div data-testid="content">Real content</div>
      </PhantomSkeleton>
    )
    const phantomEl = container.querySelector('phantom-ui')
    expect(phantomEl).toBeInTheDocument()
    expect(phantomEl).toHaveAttribute('loading', 'true')
    expect(phantomEl).toHaveAttribute('animation', 'shimmer')
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })

  it('passes reveal and animation props', () => {
    const { container } = render(
      <PhantomSkeleton loading={false} animation="pulse" reveal={0.5}>
        <div>Child</div>
      </PhantomSkeleton>
    )
    const phantomEl = container.querySelector('phantom-ui')
    expect(phantomEl).toHaveAttribute('loading', 'false')
    expect(phantomEl).toHaveAttribute('animation', 'pulse')
    expect(phantomEl).toHaveAttribute('reveal', '0.5')
  })
})
