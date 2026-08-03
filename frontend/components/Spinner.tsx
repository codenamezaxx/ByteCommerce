export default function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? '1rem' : size === 'lg' ? '2rem' : '1.5rem';
  return (
    <div style={{ display: 'inline-block', width: s, height: s }}>
      <div className="spinner-lg" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

export function PageSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem 0' }}>
      <div className="spinner-lg" />
    </div>
  );
}
