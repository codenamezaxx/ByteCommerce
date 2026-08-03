'use client';

import { useState, useEffect } from 'react';
import { calcTimeLeft, pad } from '@/lib/utils';

interface CountdownTimerProps {
  targetDate: Date;
  onEnd?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

export default function CountdownTimer({ targetDate, onEnd, size = 'md', showLabels = false }: CountdownTimerProps) {
  const [time, setTime] = useState(() => calcTimeLeft(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      const left = calcTimeLeft(targetDate);
      setTime(left);
      if (left.total <= 0) {
        clearInterval(interval);
        onEnd?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate, onEnd]);

  if (time.total <= 0) {
    return <span className="countdown-label">Berakhir</span>;
  }

  const fontSize = size === 'sm' ? '1rem' : size === 'lg' ? '2rem' : '1.5rem';

  return (
    <div>
      <div className="countdown" style={{ fontSize }}>
        <span>{pad(time.hours + time.days * 24)}</span>
        <span className="separator">:</span>
        <span>{pad(time.minutes)}</span>
        <span className="separator">:</span>
        <span>{pad(time.seconds)}</span>
      </div>
      {showLabels && (
        <div style={{display:'flex', justifyContent:'center', gap:'2rem', marginTop:'0.5rem', fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.06em', color:'#94A3B8', fontWeight:500}}>
          <span>Jam</span>
          <span>Menit</span>
          <span>Detik</span>
        </div>
      )}
    </div>
  );
}
