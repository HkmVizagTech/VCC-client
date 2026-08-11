"use client";

import { useRef, useState } from "react";
import { Camera, Upload, X, Loader2, ImageIcon } from "lucide-react";
import { compressImage } from "@/lib/utils/compress-image";
import { API_URL } from "@/lib/api";

interface Props {
  value: string | null;
  onChange: (key: string | null) => void;
  disabled?: boolean;
}

type State = "idle" | "compressing" | "uploading" | "done" | "error";

export function PhotoCapture({ value, onChange, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  async function processFile(file: File) {
    setError(null);
    setState("compressing");
    try {
      const compressed = await compressImage(file, 950_000);
      setState("uploading");

      const form = new FormData();
      form.append("photo", compressed, "photo.jpg");

      const res = await fetch(`${API_URL}/api/upload/photo`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Upload failed");
      }

      const { key } = await res.json();
      setPreview(URL.createObjectURL(compressed));
      onChange(key);
      setState("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setState("error");
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    processFile(file);
  }

  function clear() {
    setPreview(null);
    onChange(null);
    setState("idle");
    setError(null);
  }

  const busy = state === "compressing" || state === "uploading";

  const label =
    state === "compressing"
      ? "Compressing…"
      : state === "uploading"
        ? "Uploading…"
        : value
          ? "Change photo"
          : "Add photo";

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
        disabled={disabled || busy}
      />

      {preview || value ? (
        <div className="relative inline-block">
          <img
            src={
              preview ??
              `/api/upload/photo?key=${encodeURIComponent(value!)}`
            }
            alt="Volunteer photo"
            className="h-28 w-28 rounded-lg border object-cover shadow-sm"
          />
          {!disabled && !busy && (
            <button
              type="button"
              onClick={clear}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
              title="Remove photo"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
          className="flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-input bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/60 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <ImageIcon className="h-6 w-6" />
          )}
          <span className="text-xs font-medium">{label}</span>
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        {(value || preview) && !busy && !disabled && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent"
          >
            <Upload className="h-3 w-3" />
            {label}
          </button>
        )}
        {!value && !preview && !busy && !disabled && (
          <>
            <button
              type="button"
              onClick={() => {
                if (fileRef.current) {
                  fileRef.current.removeAttribute("capture");
                  fileRef.current.click();
                  fileRef.current.setAttribute("capture", "environment");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent"
            >
              <Upload className="h-3 w-3" />
              Upload file
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent"
            >
              <Camera className="h-3 w-3" />
              Take photo
            </button>
          </>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {state === "done" && (
        <p className="text-xs text-green-600 dark:text-green-400">
          Photo uploaded
        </p>
      )}
    </div>
  );
}
