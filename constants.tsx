
import React from 'react';

export const ADMIN_PASSWORD = "6749467";

export const RACER_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#eab308', // Yellow
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

// 레이서별 자동차 이미지 URL
export const RACER_CAR_IMAGES: Record<string, string> = {
  '1': 'https://i.ibb.co/9xY5PxL/r1.png',
  '2': 'https://i.ibb.co/HTK50ZcB/r2.png',
  '3': 'https://i.ibb.co/hRGw86n9/r3.png',
  '4': 'https://i.ibb.co/x8RrmWzD/r4.png',
  '5': 'https://i.ibb.co/M5x1fD3X/r5.png',
  '6': 'https://i.ibb.co/gLww9GJV/r6.png',
  '7': 'https://i.ibb.co/5xBBHrJh/r7.png',
  '8': 'https://i.ibb.co/gbjb9s5G/r8.png',
};

// 절벽 이미지 URL
export const CLIFF_IMAGE = 'https://i.ibb.co/20YjYQJm/criff.jpg';

// 레거시 CarIcon (하위 호환성을 위해 유지)
export const CarIcon = ({ color, size = 24 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 11V16H20V11L18 7H6L4 11Z" fill={color} />
    <circle cx="7" cy="18" r="2" fill="#333" />
    <circle cx="17" cy="18" r="2" fill="#333" />
    <path d="M18 11H6L7.5 8H16.5L18 11Z" fill="white" opacity="0.3" />
    <path d="M3 13H5M19 13H21" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 레이서 자동차 이미지 컴포넌트
export const RacerCarImage = ({ racerId, size = 40 }: { racerId: string; size?: number }) => {
  const imageUrl = RACER_CAR_IMAGES[racerId];
  if (!imageUrl) {
    return <CarIcon color={RACER_COLORS[parseInt(racerId) - 1] || '#888'} size={size} />;
  }
  return (
    <img
      src={imageUrl}
      alt={`Racer ${racerId}`}
      style={{ width: size, height: size, objectFit: 'contain' }}
      draggable={false}
    />
  );
};
