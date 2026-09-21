"use client";
import { forwardRef, useState, type ComponentProps } from "react";
import { useParams } from "next/navigation";
import type {
  MediaContext,
  MediaPurpose,
} from "@garsonless/domain/media-library";
import { MediaPicker, type SelectedMedia } from "./MediaLibrary";
/** Preserves existing accessible upload triggers while sharing one picker. */
export const MediaInput = forwardRef<
  HTMLInputElement,
  Omit<ComponentProps<"input">, "type"> & {
    restaurantId?: string;
    context: MediaContext;
    purpose?: MediaPurpose;
    onMedia: (media: SelectedMedia[]) => void | Promise<void>;
  }
>(function MediaInput(
  { restaurantId, context, purpose = "image", onMedia, multiple, ...props },
  ref,
) {
  const params = useParams();
  const rid =
    restaurantId ??
    (typeof params?.restaurantId === "string" ? params.restaurantId : "");
  const [open, setOpen] = useState(false);
  return (
    <>
      <input
        {...props}
        ref={ref}
        type="file"
        multiple={multiple}
        onClick={(event) => {
          if (rid) {
            event.preventDefault();
            setOpen(true);
          } else props.onClick?.(event);
        }}
      />
      {rid && (
        <MediaPicker
          restaurantId={rid}
          context={context}
          purpose={purpose}
          multiple={multiple}
          open={open}
          onOpenChange={setOpen}
          onSelect={onMedia}
        />
      )}
    </>
  );
});
