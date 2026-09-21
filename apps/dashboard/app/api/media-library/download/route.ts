import { z } from "zod";
import { MEDIA_CONTEXTS } from "@garsonless/domain/media-library";
import { mediaService } from "../../../../lib/media-library-server";
export async function GET(request: Request) {
  try {
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const input = z
      .object({
        restaurantId: z.string().uuid(),
        id: z.string().uuid(),
        context: z.enum(MEDIA_CONTEXTS),
      })
      .parse(query);
    const service = await mediaService(input.restaurantId, input.context);
    const source = await service.command<{
      bucket: string;
      path: string;
      url: string;
    }>("source", { id: input.id });
    const url =
      source.bucket === "restaurant-media-sources"
        ? await service.port.sourceUrl(source.path)
        : source.url;
    return Response.redirect(url, 303);
  } catch {
    return Response.json({ error: "Dosyaya erişilemiyor." }, { status: 403 });
  }
}
