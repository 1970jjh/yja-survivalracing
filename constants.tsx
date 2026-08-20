
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

// 차체색을 어둡게 변환 (사이드포드 음영용)
const shadeColor = (hex: string, f: number): string => {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.round(((num >> 16) & 255) * f);
  const g = Math.round(((num >> 8) & 255) * f);
  const b = Math.round((num & 255) * f);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
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

// 레이서 자동차 이미지 컴포넌트 (프로젝트 내장 SVG)
// 외부 CDN(i.ibb.co)에서 PNG를 불러오던 방식은 사내망 등 제한된 네트워크에서 차단되어
// 차량이 보이지 않는 문제가 있어, 외부 요청이 전혀 없는 인라인 SVG로 대체했다.
export const RacerCarImage = ({ racerId, size = 40 }: { racerId: string; size?: number }) => {
  const idx = parseInt(racerId, 10);
  const color = RACER_COLORS[idx - 1] || '#888888';
  const dark = shadeColor(color, 0.72);
  const label = Number.isNaN(idx) ? '' : String(idx);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Racer ${racerId}`}
      style={{ display: 'block' }}
    >
      <g stroke="#0b0b0b" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
        {/* 리어윙 */}
        <rect x="6" y="36" width="8" height="26" rx="1.5" fill="#161616" />
        <rect x="3" y="33" width="15" height="6" rx="1.5" fill="#161616" />
        {/* 차체 */}
        <path d="M12,61 L12,48 Q13,44 19,44 L56,44 L62,35 Q65,32 70,34 L74,45 L97,53 L74,61 Z" fill={color} />
        {/* 사이드포드 흡기구 */}
        <path d="M74,46 L82,49 L80,57 L74,58 Z" fill={dark} />
        {/* 콕핏 */}
        <ellipse cx="66" cy="41" rx="6" ry="3.6" fill="#12151c" strokeWidth={2} />
        {/* 드라이버 헬멧 */}
        <circle cx="66" cy="41" r="2.6" fill="#f8fafc" strokeWidth={1.4} />
        {/* 프론트윙 */}
        <rect x="84" y="59" width="15" height="4.5" rx="1" fill="#161616" />
        <rect x="95.5" y="52" width="3.5" height="12" rx="1" fill="#161616" />
        {/* 바퀴 */}
        <circle cx="28" cy="64" r="11" fill="#141414" />
        <circle cx="28" cy="64" r="5" fill="#4b5563" strokeWidth={2} />
        <circle cx="80" cy="64" r="11" fill="#141414" />
        <circle cx="80" cy="64" r="5" fill="#4b5563" strokeWidth={2} />
        {/* 번호 (작은 화면에서도 잘 보이도록 크게) */}
        <circle cx="50" cy="50" r="14" fill="#f8fafc" strokeWidth={3} />
        <text
          x="50"
          y="51.5"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Arial Black, Arial, sans-serif"
          fontWeight={900}
          fontSize={21}
          fill="#0b0b0b"
          stroke="none"
        >
          {label}
        </text>
      </g>
    </svg>
  );
};
