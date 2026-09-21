import { requireSection } from "../../../../lib/auth/access";
import MediaLibrary from "../../../../components/media-library/MediaLibrary";
export default async function FilesPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  await requireSection(restaurantId, "files");
  return (
    <main className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 p-4 sm:p-8">
        <header>
          <p className="text-sm text-muted-foreground">İçerik</p>
          <h1 className="text-2xl font-semibold">Dosyalar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bir kez yükleyin, menü ve temanızda tekrar kullanın.
          </p>
        </header>
        <MediaLibrary restaurantId={restaurantId} />
      </div>
    </main>
  );
}
