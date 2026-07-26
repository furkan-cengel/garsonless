type CardLayoutOptionIconProps = {
  fieldId: string;
  value: string;
  size?: number;
};

export function CardLayoutOptionIcon({
  fieldId,
  value,
  size = 20,
}: CardLayoutOptionIconProps) {
  const icon = getCardLayoutOptionIcon(fieldId, value);
  if (!icon) return null;

  return (
    <IconSvg size={size}>
      {icon}
    </IconSvg>
  );
}

export function ThemeEditorControlIcon({
  name,
  size = 20,
}: {
  name: "copy" | "history" | "menu" | "down" | "minus" | "plus";
  size?: number;
}) {
  return <IconSvg size={size}>{getThemeEditorControlIcon(name)}</IconSvg>;
}

function IconSvg({ children, size }: { children: ReactNode; size: number }) {
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
      {children}
    </svg>
  );
}

function getCardLayoutOptionIcon(fieldId: string, value: string) {
  if (fieldId === "cardLayout") {
    if (value === "vertical") {
      return (
        <>
          <rect x="4" y="3.5" width="16" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9.33 4v16M14.67 4v16" stroke="currentColor" strokeWidth="1.8" />
        </>
      );
    }
    if (value === "horizontal") {
      return (
        <>
          <rect x="3.5" y="4" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 9.33h16M4 14.67h16" stroke="currentColor" strokeWidth="1.8" />
        </>
      );
    }
    if (value === "minimal") {
      return (
        <>
          <rect x="4" y="3.5" width="16" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    }
  }

  if (fieldId === "cardDensity") {
    if (value === "compact") {
      return (
        <>
          <rect x="8.5" y="5" width="11.5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="8.5" y="14" width="11.5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="m3.5 7.5 2-2v4l-2-2ZM3.5 16.5l2-2v4l-2-2Z" fill="currentColor" />
        </>
      );
    }
    if (value === "normal") {
      return (
        <>
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 10h16" stroke="currentColor" strokeWidth="1.8" />
        </>
      );
    }
    if (value === "spacious") {
      return (
        <>
          <rect x="3.5" y="6" width="17" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 10h16M7 14h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    }
  }

  if (fieldId === "cardPriceAlign") {
    if (value === "left") {
      return <path d="m10 7-5 5 5 5M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
    }
    if (value === "right") {
      return <path d="m14 7 5 5-5 5M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
    }
  }

  if (fieldId === "cardImageFit") {
    if (value === "cover") {
      return (
        <>
          <rect x="3.5" y="4" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M7 4v4H3.5M17 4v4h3.5M7 20v-4H3.5M17 20v-4h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </>
      );
    }
    if (value === "contain") {
      return (
        <>
          <rect x="3.5" y="4" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="7" y="8" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="m8 15 3-3 2 2 1.5-1.5L17 15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </>
      );
    }
  }

  if (fieldId === "cardImagePosition") {
    if (value === "top") {
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="7" y="7" width="10" height="5" rx="1.5" fill="currentColor" />
          <path d="M8 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".4" />
        </>
      );
    }
    if (value === "center") {
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="7" y="9.5" width="10" height="5" rx="1.5" fill="currentColor" />
        </>
      );
    }
    if (value === "bottom") {
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="7" y="12" width="10" height="5" rx="1.5" fill="currentColor" />
          <path d="M8 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".4" />
        </>
      );
    }
  }

  return null;
}

function getThemeEditorControlIcon(
  name: "copy" | "history" | "menu" | "down" | "minus" | "plus",
) {
  if (name === "copy") {
    return (
      <>
        <rect x="8" y="8" width="11" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    );
  }
  if (name === "history") {
    return (
      <>
        <path d="M4 7v5h5M5 11a8 8 0 1 0 2-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  }
  if (name === "minus") {
    return <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />;
  }
  if (name === "plus") {
    return <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />;
  }
  if (name === "menu") {
    return (
      <path
        d="m7 9.5 5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (name === "down") return (
    <path
      d="m7 9.5 5 5 5-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
  return null;
}
import type { ReactNode } from "react";
