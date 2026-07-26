import type { ReactNode } from "react";

type HeaderOptionIconProps = {
  fieldId: string;
  value: string;
  size?: number;
};

export function HeaderOptionIcon({
  fieldId,
  value,
  size = 20,
}: HeaderOptionIconProps) {
  const icon = getHeaderOptionIcon(fieldId, value);
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

function getHeaderOptionIcon(fieldId: string, value: string): ReactNode {
  if (fieldId === "headerLogoStyle") {
    if (value === "display") {
      return (
        <>
          <path
            d="M4 19 9.5 5h2L17 19M6.2 14h8.6"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17 9h3M18.5 7.5v3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      );
    }
    if (value === "wordmark") {
      return (
        <path
          d="M5 5h14M12 5v14M8.5 19h7"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      );
    }
    if (value === "image") {
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
          <circle cx="8.5" cy="8.5" r="1.6" fill="currentColor" />
          <path
            d="m5.5 18 4-4.5 3 3 2-2 4 3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    }
  }

  if (fieldId === "headerStyle") {
    if (value === "solid") {
      return (
        <>
          <path
            d="M12 3.5c1.8 3.2 5.5 6.6 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.1 10.2 6.7 12 3.5Z"
            fill="currentColor"
          />
          <path
            d="M9 14.5c.3 1.3 1.3 2 2.5 2"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      );
    }
    if (value === "blur") {
      return (
        <>
          <circle cx="12" cy="12" r="3" fill="currentColor" opacity=".65" />
          <circle
            cx="12"
            cy="12"
            r="6"
            stroke="currentColor"
            strokeWidth="1.8"
            opacity=".45"
          />
          <path
            d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      );
    }
  }

  if (fieldId === "headerLayout") {
    if (value === "split") {
      return (
        <>
          <rect
            x="3.5"
            y="6"
            width="5"
            height="12"
            rx="1.5"
            fill="currentColor"
          />
          <rect
            x="11"
            y="6"
            width="9.5"
            height="5"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <rect
            x="11"
            y="14"
            width="7"
            height="4"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </>
      );
    }
    if (value === "center") {
      return (
        <>
          <rect
            x="8.5"
            y="4"
            width="7"
            height="7"
            rx="1.8"
            fill="currentColor"
          />
          <path
            d="M5 15h14M8 19h8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      );
    }
    if (value === "stacked") {
      return (
        <>
          <rect
            x="5"
            y="3.5"
            width="14"
            height="7"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M5 14h14M5 18.5h10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      );
    }
    if (value === "compact") {
      return (
        <>
          <rect
            x="3.5"
            y="7"
            width="17"
            height="10"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="8" cy="12" r="2" fill="currentColor" />
          <path
            d="M12 10.5h6M12 13.5h4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      );
    }
  }

  if (fieldId === "headerAlign") {
    if (value === "left") {
      return (
        <path
          d="M5 5v14M9 8h10M9 12h7M9 16h9"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      );
    }
    if (value === "center") {
      return (
        <>
          <path
            d="M12 4v16"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="2 3"
            opacity=".55"
          />
          <path
            d="M5 8h14M7 12h10M5.5 16h13"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </>
      );
    }
  }

  return null;
}
