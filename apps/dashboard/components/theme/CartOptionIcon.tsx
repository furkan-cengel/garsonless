import type { ReactNode } from "react";

type CartOptionIconProps = {
  fieldId: string;
  value: string;
  size?: number;
};

export function CartOptionIcon({
  fieldId,
  value,
  size = 20,
}: CartOptionIconProps) {
  const icon = getCartOptionIcon(fieldId, value);
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

function getCartOptionIcon(fieldId: string, value: string): ReactNode {
  if (
    (fieldId === "cartHeaderTriggerStyle" ||
      fieldId === "cartFooterTriggerStyle") &&
    value === "none"
  ) {
    return (
      <path
        d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    );
  }

  if (fieldId === "cartHeaderTriggerStyle") {
    if (value === "icon") {
      return (
        <>
          <path
            d="M3.5 5h2l1.7 9a2 2 0 0 0 2 1.7h7.8a2 2 0 0 0 2-1.6L20.5 8H6.1"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9.5" cy="19" r="1.25" fill="currentColor" />
          <circle cx="17.5" cy="19" r="1.25" fill="currentColor" />
          <circle
            cx="18.5"
            cy="5"
            r="3.2"
            fill="currentColor"
            stroke="white"
            strokeWidth="1.2"
          />
        </>
      );
    }
    if (value === "pill") {
      return (
        <>
          <rect
            x="2.5"
            y="6"
            width="19"
            height="12"
            rx="6"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M7 10.5h4M7 13.5h6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx="17" cy="12" r="2" fill="currentColor" />
        </>
      );
    }
  }

  if (fieldId === "cartFooterTriggerStyle") {
    if (value === "pill") {
      return (
        <>
          <rect
            x="3"
            y="7"
            width="18"
            height="10"
            rx="5"
            fill="currentColor"
            opacity=".14"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M7 10h1l.8 3h5.7l.7-2.2H8.2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="15" r=".8" fill="currentColor" />
          <circle cx="14.5" cy="15" r=".8" fill="currentColor" />
          <path
            d="M17.5 12h1.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      );
    }
    if (value === "bar") {
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
          <path d="M4 15h16" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M7 18h6M16 17.5h1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      );
    }
    if (value === "fab") {
      return (
        <>
          <circle
            cx="12"
            cy="12"
            r="8.5"
            fill="currentColor"
            opacity=".14"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M8 9h1l.8 5h5.8l.8-3.5H9.3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="11" cy="16.5" r=".8" fill="currentColor" />
          <circle cx="15.5" cy="16.5" r=".8" fill="currentColor" />
        </>
      );
    }
    if (value === "thumbs") {
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
            width="5"
            height="5"
            rx="1.2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M14 8h4M14 11h3M7 16h7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="17" cy="16" r="2" fill="currentColor" />
        </>
      );
    }
  }

  if (fieldId === "cartIcon") {
    if (value === "cart") {
      return (
        <>
          <path
            d="M3.5 5h2l1.7 9.1a2 2 0 0 0 2 1.65h7.9a2 2 0 0 0 1.95-1.55L20.5 8H6.1"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9.5" cy="19" r="1.25" fill="currentColor" />
          <circle cx="17.5" cy="19" r="1.25" fill="currentColor" />
        </>
      );
    }
    if (value === "bag") {
      return (
        <>
          <path
            d="M5 8.5h14l1 11H4l1-11Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2M8.5 12.5a3.5 3.5 0 0 0 7 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      );
    }
    if (value === "basket") {
      return (
        <>
          <path
            d="m5 10 2 9h10l2-9H5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="m8 10 4-6 4 6M4 10h16M9 14v2M12 14v2M15 14v2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      );
    }
  }

  if (fieldId === "cartPillTone") {
    if (value === "dark") {
      return (
        <path
          d="M12 3.5c1.8 3.2 5.5 6.6 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.1 10.2 6.7 12 3.5Z"
          fill="currentColor"
        />
      );
    }
    if (value === "accent") {
      return (
        <path
          d="M12 3.5c1.8 3.2 5.5 6.6 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.1 10.2 6.7 12 3.5Z"
          fill="currentColor"
          opacity=".38"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      );
    }
    if (value === "light") {
      return (
        <>
          <path
            d="M12 3.5c1.8 3.2 5.5 6.6 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.1 10.2 6.7 12 3.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M17.5 3v3M19 4.5h-3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      );
    }
  }

  if (fieldId === "cartDrawerTone") {
    if (value === "clean") {
      return (
        <>
          <rect
            x="4"
            y="3.5"
            width="16"
            height="17"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M7 8h10M7 12h7M7 16h8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      );
    }
    if (value === "accentHeader") {
      return (
        <>
          <rect
            x="4"
            y="3.5"
            width="16"
            height="17"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M4 8.5h16" stroke="currentColor" strokeWidth="1.8" />
          <rect
            x="6.5"
            y="5.5"
            width="7"
            height="1.5"
            rx=".75"
            fill="currentColor"
          />
          <path
            d="M7 12h10M7 16h7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      );
    }
  }

  if (fieldId === "cartPillPosition") {
    if (value === "floating") {
      return (
        <>
          <rect
            x="3"
            y="7"
            width="18"
            height="10"
            rx="5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M6 4.5h12M8 20h8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity=".45"
          />
        </>
      );
    }
    if (value === "edge") {
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
          <path d="M4 15h16" stroke="currentColor" strokeWidth="1.8" />
          <rect
            x="7"
            y="17"
            width="10"
            height="1.5"
            rx=".75"
            fill="currentColor"
          />
        </>
      );
    }
  }

  return null;
}
