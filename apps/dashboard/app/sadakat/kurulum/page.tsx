import SadakatBusinessForm from "./SadakatBusinessForm";
import { getDashboardRequestAuth } from "../../../lib/auth/current-user";
export default async function SadakatSetup() {
  await getDashboardRequestAuth();
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 p-6">
      <h1 className="text-3xl font-semibold">Masabu Sadakat’e başla</h1>
      <p className="text-muted-foreground">
        İşletmeni oluştur. Masabu ekibi pilot erişimini açtıktan sonra kartını
        yayınlayabilirsin.
      </p>
      <SadakatBusinessForm />
    </main>
  );
}
