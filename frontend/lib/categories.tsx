import React from 'react';
import { Monitor, Shirt, Gem, Heart } from 'lucide-react';

export interface Category {
  label: string;
  icon: React.ReactNode;
}

export const CATEGORIES: Category[] = [
  {
    label: 'Elektronik',
    icon: <Monitor size={28} stroke="var(--muted)" strokeWidth={1.5} />,
  },
  {
    label: 'Fashion',
    icon: <Shirt size={28} stroke="var(--muted)" strokeWidth={1.5} />,
  },
  {
    label: 'Aksesoris',
    icon: <Gem size={28} stroke="var(--muted)" strokeWidth={1.5} />,
  },
  {
    label: 'Kesehatan',
    icon: <Heart size={28} stroke="var(--muted)" strokeWidth={1.5} />,
  },
];
