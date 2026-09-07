"use client";
import { useEffect } from "react";
import { LEGAL_DOCUMENT_VERSION } from "@garsonless/domain/legal";
import { signInWithGoogle } from "../../lib/actions/google-auth";
import { useAuthAction, AuthStatus } from "./auth-form";
import styles from "../../app/auth/login/login.module.css";
export default function GoogleSignIn({
  next,
  signup,
  accepted,
  disabled,
  onBusyChange,
}: {
  next: string;
  signup: boolean;
  accepted: boolean;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const action = useAuthAction(signInWithGoogle);
  useEffect(() => {
    onBusyChange(action.pending);
  }, [action.pending, onBusyChange]);
  return (
    <form
      ref={action.ref}
      onSubmit={action.onSubmit}
      action={action.dispatch}
      className={styles.form}
    >
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="signup" value={String(signup)} />
      <input type="hidden" name="termsAccepted" value={accepted ? "on" : ""} />
      <input type="hidden" name="termsVersion" value={LEGAL_DOCUMENT_VERSION} />
      <div className={styles.oauthDivider}>
        <span>veya</span>
      </div>
      <AuthStatus state={action.state} />
      <button
        type="submit"
        className={styles.googleButton}
        disabled={disabled || action.pending}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.01v2.5h3.22c1.89-1.74 2.99-4.3 2.99-7.34Z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 4.96-.9 6.61-2.43l-3.22-2.5c-.9.6-2.05.97-3.39.97-2.61 0-4.82-1.76-5.61-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
          />
          <path
            fill="#FBBC05"
            d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.51l3.32-2.59Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.96c1.47 0 2.79.51 3.83 1.51L18.7 4.6A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.32 2.59C7.18 7.72 9.39 5.96 12 5.96Z"
          />
        </svg>
        {action.pending ? "Google açılıyor…" : "Google ile devam et"}
      </button>
    </form>
  );
}
