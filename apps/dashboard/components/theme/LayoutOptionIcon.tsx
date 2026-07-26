import type { ReactNode } from "react";

type LayoutOptionIconProps = {
  fieldId: string;
  value: string;
  size?: number;
};

export function LayoutOptionIcon({
  fieldId,
  value,
  size = 20,
}: LayoutOptionIconProps) {
  const icon = getLayoutOptionIcon(fieldId, value);
  if (!icon) return null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      focusable="false"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}

function getLayoutOptionIcon(fieldId: string, value: string): ReactNode {
  if (fieldId === "texture") {
    if (value === "solid") {
      return (
        <rect
          x="3.5"
          y="3.5"
          width="17"
          height="17"
          rx="3"
          fill="currentColor"
          opacity=".12"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      );
    }
    if (value === "grid") {
      return (
        <>
          <rect
            x="3.5"
            y="3.5"
            width="17"
            height="17"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M9.17 4v16M14.83 4v16M4 9.17h16M4 14.83h16"
            stroke="currentColor"
            strokeWidth="1.35"
            opacity=".72"
          />
        </>
      );
    }
    if (value === "noise") {
      return (
        <>
          <rect
            x="3.5"
            y="3.5"
            width="17"
            height="17"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <g fill="currentColor">
            <circle cx="8" cy="8" r="1" />
            <circle cx="12" cy="8" r="1" />
            <circle cx="16" cy="8" r="1" />
            <circle cx="8" cy="12" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="16" cy="12" r="1" />
            <circle cx="8" cy="16" r="1" />
            <circle cx="12" cy="16" r="1" />
            <circle cx="16" cy="16" r="1" />
          </g>
        </>
      );
    }
  }

  if (fieldId === "sectionHeading") {
    if (value === "accent") {
      return (
        <>
          <rect
            x="3.5"
            y="4"
            width="17"
            height="16"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <rect
            x="6.5"
            y="7"
            width="11"
            height="5"
            rx="1.5"
            fill="currentColor"
          />
          <path
            d="M7 16h7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      );
    }
    if (value === "editorial") {
      return (
        <>
          <path
            d="M4 5h16M8 5v14M5 19h6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M13 10h7M13 14h5M13 18h7"
            stroke="currentColor"
            strokeWidth="1.55"
            strokeLinecap="round"
            opacity=".7"
          />
        </>
      );
    }
    if (value === "catalog") {
      return (
        <>
          <path
            d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M15 3.5V8h4M8 11h8M8 15h8M8 18h5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      );
    }
  }

  if (fieldId === "pageMaxWidth") {
    if (value === "none") {
      return (
        <>
          <rect
            x="3"
            y="6"
            width="18"
            height="12"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M7 3.5v17M17 3.5v17"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="2 3"
          />
        </>
      );
    }
    if (value === "960") {
      return (
        <>
          <path
            d="M3 5v14M21 5v14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity=".4"
          />
          <rect
            x="6"
            y="6"
            width="12"
            height="12"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M10 6v12" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
    }
    if (value === "1200") {
      return (
        <>
          <path
            d="M2.5 5v14M21.5 5v14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity=".4"
          />
          <rect
            x="4.5"
            y="6"
            width="15"
            height="12"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M9 6v12" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
    }
  }

  return null;
}
