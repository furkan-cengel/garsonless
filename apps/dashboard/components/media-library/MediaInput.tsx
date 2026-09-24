"use client";
import dynamic from "next/dynamic";
import { forwardRef, useState, type ComponentProps } from "react";
import { useParams } from "next/navigation";
import type {
  MediaContext,
  MediaPurpose,
} from "@garsonless/domain/media-library";
import type { SelectedMedia } from "./MediaLibrary";

// The picker (library grid, upload flow, dialogs) is only needed once the
// trigger is used, so it stays out of the initial bundle of every page that
// renders an upload field. Hover/focus starts the download early.
const loadMediaPicker = () =>
  import("./MediaLibrary").then((module) => module.MediaPicker);
const MediaPicker = dynamic(loadMediaPicker, { ssr: false });

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
  // Mounted on first use and kept mounted so closing can animate out.
  const [pickerRequested, setPickerRequested] = useState(false);
  return (
    <>
      <input
        {...props}
        ref={ref}
        type="file"
        multiple={multiple}
        onPointerEnter={(event) => {
          if (rid) void loadMediaPicker();
          props.onPointerEnter?.(event);
        }}
        onFocus={(event) => {
          if (rid) void loadMediaPicker();
          props.onFocus?.(event);
        }}
        onClick={(event) => {
          if (rid) {
            event.preventDefault();
            setPickerRequested(true);
            setOpen(true);
          } else props.onClick?.(event);
        }}
      />
      {rid && pickerRequested && (
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
