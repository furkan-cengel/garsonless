import type { ReactNode } from "react";

type NavigationOptionIconProps = {
  fieldId: string;
  value: string;
  size?: number;
};

export function NavigationOptionIcon({
  fieldId,
  value,
  size = 20,
}: NavigationOptionIconProps) {
  const icon = getNavigationOptionIcon(fieldId, value);
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

function getNavigationOptionIcon(fieldId: string, value: string): ReactNode {
  if (fieldId === "catnavStyle") {
    if (value === "pills") {
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="6" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="8" cy="12" r="2" fill="currentColor" />
          <path d="M12 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    }
    if (value === "visual") {
      return (
        <>
          <rect x="3.5" y="4" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="8" cy="8.5" r="1.4" fill="currentColor" />
          <path d="m5.5 17 4-4.5 3 3 2-2 4 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    }
    if (value === "underline") {
      return (
        <>
          <path d="M5 7h14M5 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".45" />
          <path d="M5 18h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
    }
    if (value === "segmented") {
      return (
        <>
          <rect x="2.5" y="6" width="19" height="12" rx="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 6v12M15 6v12" stroke="currentColor" strokeWidth="1.8" />
          <rect x="9" y="6" width="6" height="12" fill="currentColor" opacity=".16" />
        </>
      );
    }
    if (value === "dots") {
      return (
        <>
          <circle cx="5" cy="12" r="2" fill="currentColor" />
          <path d="M9.5 12H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    }
    if (value === "outlined") {
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    }
  }

  if (fieldId === "catnavActiveStyle") {
    if (value === "filled") {
      return (
        <>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H14l7 7-9.5 9.5a2.2 2.2 0 0 1-3.1 0l-4-4a2.2 2.2 0 0 1-.4-2.6V5.5Z" fill="currentColor" />
          <circle cx="9" cy="8" r="1.6" fill="white" />
        </>
      );
    }
    if (value === "soft") {
      return (
        <>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H14l7 7-9.5 9.5a2.2 2.2 0 0 1-3.1 0l-4-4a2.2 2.2 0 0 1-.4-2.6V5.5Z" fill="currentColor" opacity=".16" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="9" cy="8" r="1.4" fill="currentColor" />
        </>
      );
    }
    if (value === "outline") {
      return (
        <>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H14l7 7-9.5 9.5a2.2 2.2 0 0 1-3.1 0l-4-4a2.2 2.2 0 0 1-.4-2.6V5.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="9" cy="8" r="1.4" fill="currentColor" />
        </>
      );
    }
  }

  if (fieldId === "catnavAlign") {
    if (value === "left") {
      return <path d="m9 7-5 5 5 5M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
    }
    if (value === "center") {
      return (
        <>
          <path d="M12 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2.5 3" />
          <path d="m8 8-4 4 4 4M16 8l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    }
    if (value === "spread") {
      return (
        <>
          <path d="M4 16c3-6 13-6 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="5" cy="15" r="1.5" fill="currentColor" />
          <circle cx="12" cy="11" r="1.5" fill="currentColor" />
          <circle cx="19" cy="15" r="1.5" fill="currentColor" />
        </>
      );
    }
  }

  if (fieldId === "catnavDensity") {
    if (value === "compact") {
      return (
        <>
          <rect x="8" y="5" width="12" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="8" y="14" width="12" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="m3 7.5 3-2v4l-3-2ZM3 16.5l3-2v4l-3-2Z" fill="currentColor" />
        </>
      );
    }
    if (value === "normal") {
      return (
        <>
          <rect x="4" y="5" width="16" height="5" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <rect x="4" y="14" width="16" height="5" rx="2" stroke="currentColor" strokeWidth="1.8" />
        </>
      );
    }
    if (value === "comfortable") {
      return (
        <>
          <rect x="4" y="3.5" width="16" height="4.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <rect x="4" y="16" width="16" height="4.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 10v4m0-4-2 2m2-2 2 2m-2 2-2-2m2 2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    }
  }

  return null;
}
