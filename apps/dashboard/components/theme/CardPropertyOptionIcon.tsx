type CardPropertyOptionIconProps = {
  fieldId: string;
  value: string;
  size?: number;
};

export function CardPropertyOptionIcon({
  fieldId,
  value,
  size = 20,
}: CardPropertyOptionIconProps) {
  const icon = getCardPropertyOptionIcon(fieldId, value);

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

function getCardPropertyOptionIcon(fieldId: string, value: string) {
  if (fieldId === "cardHover") {
    if (value === "none") {
      return (
        <path
          d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      );
    }
    if (value === "lift") {
      return (
        <>
          <path
            d="M5 17 17 5M10 5h7v7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 11v6h6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".45"
          />
        </>
      );
    }
    if (value === "glow") {
      return (
        <>
          <path
            d="M12 3.5c.45 3.93 2.57 6.05 6.5 6.5-3.93.45-6.05 2.57-6.5 6.5-.45-3.93-2.57-6.05-6.5-6.5 3.93-.45 6.05-2.57 6.5-6.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M18.5 3v3M20 4.5h-3M5.5 16.5v4M7.5 18.5h-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      );
    }
  }

  if (fieldId === "cardPlaceholderStyle") {
    if (value === "neutral") {
      return (
        <>
          <rect
            x="3.5"
            y="4"
            width="17"
            height="16"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle
            cx="8.25"
            cy="8.75"
            r="1.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="m5 18 4.25-4.5 3 3 2.25-2.25L19 18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    }
    if (value === "accent") {
      return (
        <>
          <path
            d="M8 3.5H5.5a2 2 0 0 0-2 2V8M16 3.5h2.5a2 2 0 0 1 2 2V8M8 20.5H5.5a2 2 0 0 1-2-2V16M16 20.5h2.5a2 2 0 0 0 2-2V16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="m6.5 17 3.25-3.5 2.5 2.5 2-2L17.5 17M8.5 9.25h.01"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    }
    if (value === "outline") {
      return (
        <>
          <rect
            x="3.5"
            y="4"
            width="17"
            height="16"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="3 3"
          />
          <path
            d="m6 17.5 3.5-4 2.75 2.75 2-2 3.75 3.25M8.5 9h.01"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    }
  }

  if (fieldId === "cardCtaStyle") {
    if (value === "icon") {
      return (
        <>
          <rect
            x="3.5"
            y="3.5"
            width="17"
            height="17"
            rx="5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M12 8v8M8 12h8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
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
            d="M12 9v6M9 12h6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      );
    }
    if (value === "full") {
      return (
        <>
          <rect
            x="2.5"
            y="6"
            width="19"
            height="12"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M12 9v6M9 12h6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      );
    }
  }

  if (fieldId === "cardCtaIcon") {
    if (value === "plus") {
      return (
        <path
          d="M12 4.5v15M4.5 12h15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      );
    }
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
  }

  return null;
}
