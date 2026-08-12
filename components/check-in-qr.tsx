"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  eventId: string;
  eventName: string;
}

export function CheckInQr({ eventId, eventName }: Props) {
  const [url, setUrl] = useState<string>("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkInUrl = `${window.location.origin}/check-in/${encodeURIComponent(eventId)}`;
    setUrl(checkInUrl);
    let cancelled = false;
    QRCode.toDataURL(checkInUrl, {
      width: 260,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Check-in link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4 py-2">
      <div className="flex h-64 w-64 items-center justify-center rounded-lg border bg-white p-3">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={`Check-in QR for ${eventName}`} className="h-full w-full" />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="w-full space-y-1.5 text-center">
        <p className="text-sm font-medium">
          {eventName} — Venue Check-in
        </p>
        <p className="break-all text-xs text-muted-foreground">{url}</p>
      </div>

      <p className="max-w-xs text-center text-xs text-muted-foreground">
        Print this QR and place it at the venue. Volunteers scan it, enter their
        phone number, and their attendance is confirmed.
      </p>

      <Button variant="outline" size="sm" onClick={copyUrl}>
        <Copy className="mr-2 h-3.5 w-3.5" />
        Copy link
      </Button>
    </div>
  );
}
