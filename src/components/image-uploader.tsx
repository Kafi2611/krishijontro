"use client";
// A photo picker for forms. Each chosen photo is uploaded at once to /api/upload,
// then shown as a small preview with a remove (X) button.
// The form only keeps the list of photo addresses, e.g. ["/uploads/ab12....jpg"].
import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/validators/upload";
import type { ValidationKey } from "@/lib/validators/types";

type ImageUploaderProps = {
  value: string[]; // addresses of the photos already chosen
  onChange: (urls: string[]) => void; // called with the new list after an upload or removal
  maxImages: number;
};

/**
 * Sends one photo to our upload API.
 * Returns { url } when it worked, or { error } with a message key.
 */
async function uploadOnePhoto(file: File): Promise<{ url?: string; error?: ValidationKey }> {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) {
      return { error: data.error ?? "uploadFailed" };
    }
    return { url: data.url };
  } catch {
    return { error: "uploadFailed" }; // no internet, server down...
  }
}

export function ImageUploader({ value, onChange, maxImages }: ImageUploaderProps) {
  const t = useTranslations("Uploader");
  const tError = useTranslations("Validation");
  const [isUploading, setIsUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const canAddMore = value.length < maxImages;

  /** Uploads the chosen photos one by one (only as many as there is room for). */
  async function handleFilesChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const chosenFiles = Array.from(event.target.files ?? []);
    event.target.value = ""; // clear the picker, so the same photo can be chosen again later
    const room = maxImages - value.length;
    if (chosenFiles.length > room) {
      toast.error(tError("tooManyPhotos"));
    }

    setIsUploading(true);
    const urls = [...value];
    for (const file of chosenFiles.slice(0, room)) {
      // Check the size here first, so a big photo is not sent for nothing.
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(tError("imageTooBig"));
        continue;
      }
      const result = await uploadOnePhoto(file);
      if (result.url) {
        urls.push(result.url);
      } else {
        toast.error(tError(result.error ?? "uploadFailed"));
      }
    }
    setIsUploading(false);
    onChange(urls);
  }

  /** Takes one photo out of the list (the file itself stays on the server). */
  function removePhoto(url: string) {
    onChange(value.filter((photoUrl) => photoUrl !== url));
  }

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {value.map((url, index) => (
          <li key={url} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
            <Image src={url} alt={t("photoAlt", { number: index + 1 })} fill sizes="120px" className="object-cover" />
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              className="absolute top-1 right-1 rounded-full"
              aria-label={t("remove")}
              onClick={() => removePhoto(url)}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      {/* The real file input is hidden; the big button below opens it. */}
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        multiple
        className="hidden"
        onChange={handleFilesChosen}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={!canAddMore || isUploading}
          onClick={() => fileInput.current?.click()}
        >
          {isUploading ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
          {isUploading ? t("uploading") : t("addPhotos")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t("count", { count: value.length, max: maxImages })} · {t("hint")}
        </span>
      </div>
    </div>
  );
}
