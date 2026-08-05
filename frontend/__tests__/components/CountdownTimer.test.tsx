import '../setupTests'
import { render, screen, act } from '@testing-library/react'
import CountdownTimer from '@/components/CountdownTimer'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('CountdownTimer', () => {
  it('renders countdown values (hours:minutes:seconds)', () => {
    const now = new Date('2026-08-05T12:00:00').getTime()
    jest.setSystemTime(now)
    const target = new Date('2026-08-05T12:01:30')
    render(<CountdownTimer targetDate={target} />)
    // 1 minute 30 seconds = 00:01:30
    expect(screen.getByText('00')).toBeInTheDocument() // hours
    expect(screen.getByText('01')).toBeInTheDocument() // minutes
    expect(screen.getByText('30')).toBeInTheDocument() // seconds
  })

  it('counts down over time', () => {
    const now = new Date('2026-08-05T12:00:00').getTime()
    jest.setSystemTime(now)
    const target = new Date('2026-08-05T12:02:00')
    render(<CountdownTimer targetDate={target} />)
    // Initially 2:00
    expect(screen.getByText('02')).toBeInTheDocument()

    act(() => { jest.advanceTimersByTime(5000) })

    // After 5 seconds, should show 1:55
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('55')).toBeInTheDocument()
  })

  it('shows expired state at 0', () => {
    const now = new Date('2026-08-05T12:00:00').getTime()
    jest.setSystemTime(now)
    const target = new Date('2026-08-05T12:00:00')
    render(<CountdownTimer targetDate={target} />)
    expect(screen.getByText('Berakhir')).toBeInTheDocument()
  })

  it('calls onEnd when timer reaches zero', () => {
    const onEnd = jest.fn()
    const now = new Date('2026-08-05T12:00:00').getTime()
    jest.setSystemTime(now)
    const target = new Date('2026-08-05T12:00:01')
    render(<CountdownTimer targetDate={target} onEnd={onEnd} />)
    act(() => { jest.advanceTimersByTime(2000) })
    expect(onEnd).toHaveBeenCalled()
  })
})
