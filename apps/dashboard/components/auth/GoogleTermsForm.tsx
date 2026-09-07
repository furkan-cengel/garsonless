"use client";
import Link from "next/link";
import { LEGAL_DOCUMENT_VERSION } from "@garsonless/domain/legal";
import { acceptGoogleSignupTerms } from "../../lib/actions/google-auth";
import { useAuthAction, AuthStatus } from "./auth-form";
import styles from "../../app/auth/login/login.module.css";
export default function GoogleTermsForm({ next }: { next: string }) {
  const action = useAuthAction(acceptGoogleSignupTerms);
  const marketing =
    process.env["NEXT_PUBLIC_MARKETING_URL"] ?? "https://masabu.co";
  return (
    <form
      ref={action.ref}
      onSubmit={action.onSubmit}
      action={action.dispatch}
      className={styles.form}
    >
      <header className={styles.formHeading}>
        <h1>
          Masabu’ya hoş geldin<span className={styles.period}>.</span>
        </h1>
        <p>İşletmeni oluşturmadan önce hizmet sözleşmesini incele.</p>
      </header>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="termsVersion" value={LEGAL_DOCUMENT_VERSION} />
      <label className={styles.termsLabel}>
        <input
          name="termsAccepted"
          type="checkbox"
          required
          aria-invalid={!!action.state?.fieldErrors?.termsAccepted}
        />
        <span>
          <Link
            href={marketing + "/yasal/abonelik-hizmet-sozlesmesi"}
            target="_blank"
          >
            B2B Abonelik Hizmet Sözleşmesi’ni
          </Link>{" "}
          okudum ve kabul ediyorum.
        </span>
      </label>
      <p className={styles.legalNotice}>
        Kişisel verilerinin işlenmesi hakkında{" "}
        <Link href={marketing + "/yasal/kvkk-aydinlatma-metni"} target="_blank">
          KVKK Aydınlatma Metni’ni
        </Link>{" "}
        inceleyebilirsin.
      </p>
      <AuthStatus state={action.state} />
      <button className={styles.primaryButton} disabled={action.pending}>
        {action.pending ? "Kaydediliyor…" : "Kabul et ve devam et"}
      </button>
    </form>
  );
}
