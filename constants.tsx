
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

export const CarIcon = ({ color, size = 24 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 11V16H20V11L18 7H6L4 11Z" fill={color} />
    <circle cx="7" cy="18" r="2" fill="#333" />
    <circle cx="17" cy="18" r="2" fill="#333" />
    <path d="M18 11H6L7.5 8H16.5L18 11Z" fill="white" opacity="0.3" />
    <path d="M3 13H5M19 13H21" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
