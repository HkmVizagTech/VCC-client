"use client";

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/authClient";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ClipboardList, UserCheck } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  registered: "Registered",
  assigned: "Assigned",
  confirmed: "Confirmed",
  attended: "Attended",
  no_show: "No Show",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  registered: "outline",
  assigned: "secondary",
  confirmed: "default",
  attended: "default",
  no_show: "destructive",
  cancelled: "secondary",
} as const;

const NEXT_STATUSES: Record<string, string[]> = {
  registered: ["assigned", "confirmed", "cancelled"],
  assigned: ["confirmed", "cancelled"],
  confirmed: ["attended", "no_show", "cancelled"],
  attended: [],
  no_show: [],
  cancelled: [],
};

interface RegisteredVolunteer {
  _id: string;
  name: string;
  phone: string;
  whatsappNumber?: string;
  volunteerNumber: string;
  age?: number;
  gender?: string;
  locality?: string;
  occupation?: string;
  skills?: string[];
}

interface Registration {
  _id: string;
  status: string;
  volunteerId?: RegisteredVolunteer;
  serviceId?: { _id: string; name: string } | null;
  createdAt: string;
}

interface ServiceOption {
  _id: string;
  name: string;
}

export function RegistrationsSection({
  eventId,
  services,
  canManage,
}: {
  eventId: string;
  services: ServiceOption[];
  canManage: boolean;
}) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [changingId, setChangingId] = useState<string | null>(null);

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await authFetch(
        `/api/registrations/event/${eventId}?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data.registrations);
      } else {
        toast.error("Failed to load registrations");
      }
    } catch {
      toast.error("Failed to load registrations");
    } finally {
      setLoading(false);
    }
  }, [eventId, statusFilter]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const changeStatus = async (id: string, status: string) => {
    setChangingId(id);
    try {
      const res = await authFetch(`/api/registrations/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Status changed to ${STATUS_LABELS[status]}`);
        fetchRegistrations();
      } else {
        toast.error(data.message || "Could not update status");
      }
    } catch {
      toast.error("Could not update status");
    } finally {
      setChangingId(null);
    }
  };

  const assignService = async (id: string, serviceId: string) => {
    try {
      const res = await authFetch(`/api/registrations/${id}/service`, {
        method: "PUT",
        body: JSON.stringify({ serviceId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Service assigned");
        fetchRegistrations();
      } else {
        toast.error(data.message || "Could not assign service");
      }
    } catch {
      toast.error("Could not assign service");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Registrations</h2>
          <Badge variant="secondary">{registrations.length}</Badge>
        </div>
        <Select
          value={statusFilter || null}
          onValueChange={(v) => {
            if (v && v !== "__all") setStatusFilter(v);
            else setStatusFilter("");
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : registrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <UserCheck className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">No registrations yet</p>
          <p className="text-sm text-muted-foreground">
            {statusFilter
              ? "No registrations with this status"
              : "Volunteer registrations will appear here"}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Volunteer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Skills</TableHead>
                {canManage && <TableHead>Service</TableHead>}
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((reg) => {
                const vol = reg.volunteerId;
                const next = NEXT_STATUSES[reg.status] || [];
                return (
                  <TableRow key={reg._id}>
                    <TableCell>
                      <div className="font-medium">{vol?.name || "—"}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {vol?.volunteerNumber || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {vol?.phone || "—"}
                      {vol?.whatsappNumber &&
                        vol.whatsappNumber !== vol.phone && (
                          <div className="text-xs text-muted-foreground">
                            WA: {vol.whatsappNumber}
                          </div>
                        )}
                    </TableCell>
                    <TableCell>
                      {(vol?.skills || []).length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(vol?.skills || []).slice(0, 3).map((s) => (
                            <Badge key={s} variant="outline">
                              {s.replace(/_/g, " ")}
                            </Badge>
                          ))}
                          {(vol?.skills || []).length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{(vol?.skills || []).length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Select
                          value={reg.serviceId?._id || null}
                          onValueChange={(v) => {
                            if (v) assignService(reg._id, v);
                          }}
                        >
                          <SelectTrigger className="w-44 truncate">
                            <SelectValue
                              placeholder="Assign service"
                              className="truncate"
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {services.map((s) => (
                              <SelectItem key={s._id} value={s._id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={STATUS_STYLES[reg.status] as "outline"}>
                        {STATUS_LABELS[reg.status] || reg.status}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {next.map((s) => (
                            <Button
                              key={s}
                              variant="outline"
                              size="sm"
                              disabled={changingId === reg._id}
                              onClick={() => changeStatus(reg._id, s)}
                            >
                              {STATUS_LABELS[s]}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
