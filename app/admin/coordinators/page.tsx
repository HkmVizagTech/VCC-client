"use client";

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/authClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, UserCog, Pencil, ShieldCheck, ShieldOff } from "lucide-react";
import { RefreshButton } from "@/components/refresh-button";

interface Coordinator {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  event_coordinator: "Event Coordinator",
  service_coordinator: "Service Coordinator",
};

export default function CoordinatorsPage() {
  const { user } = useAuth();
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "event_coordinator",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchCoordinators = useCallback(async () => {
    try {
      const res = await authFetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setCoordinators(
          data.users.filter((u: Coordinator) => u.role !== "super_admin")
        );
      }
    } catch {
      toast.error("Failed to fetch coordinators");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoordinators();
  }, [fetchCoordinators]);

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "event_coordinator",
    });
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error("Name, email and password are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch("/api/users/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Coordinator created");
        setDialogOpen(false);
        resetForm();
        fetchCoordinators();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Failed to create coordinator");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/users/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Coordinator updated");
        setDialogOpen(false);
        resetForm();
        fetchCoordinators();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Failed to update coordinator");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      const res = await authFetch(`/api/users/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Coordinator ${newStatus === "active" ? "activated" : "deactivated"}`);
        fetchCoordinators();
      } else {
        const data = await res.json();
        toast.error(data.message);
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const openEdit = (c: Coordinator) => {
    setEditingId(c._id);
    setForm({
      name: c.name,
      email: c.email,
      phone: c.phone || "",
      password: "",
      role: c.role,
    });
    setDialogOpen(true);
  };

  if (user?.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">
          Only Super Admin can manage coordinators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coordinators</h1>
          <p className="text-sm text-muted-foreground">
            Manage event and service coordinators
          </p>
        </div>
        <div className="flex items-center gap-2">
        <RefreshButton
          onRefresh={fetchCoordinators}
          loading={loading}
          title="Refresh coordinators"
        />
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Coordinator
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Coordinator" : "Add Coordinator"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  placeholder="+91 9876543210"
                />
              </div>
              {!editingId && (
                <>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      placeholder="Set a password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={form.role}
                      onValueChange={(v) => {
                        if (v) setForm({ ...form, role: v });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="event_coordinator">
                          Event Coordinator
                        </SelectItem>
                        <SelectItem value="service_coordinator">
                          Service Coordinator
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <Button
                className="w-full"
                onClick={editingId ? handleUpdate : handleCreate}
                disabled={submitting}
              >
                {submitting
                  ? "Saving..."
                  : editingId
                    ? "Update"
                    : "Create Coordinator"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : coordinators.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <UserCog className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">No coordinators yet</p>
          <p className="text-sm text-muted-foreground">
            Add event or service coordinators to get started
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coordinators.map((c) => (
                <TableRow key={c._id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {roleLabels[c.role] || c.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        c.status === "active" ? "default" : "secondary"
                      }
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(c)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              title={
                                c.status === "active"
                                  ? "Deactivate"
                                  : "Activate"
                              }
                            />
                          }
                        >
                          {c.status === "active" ? (
                            <ShieldOff className="h-4 w-4 text-destructive" />
                          ) : (
                            <ShieldCheck className="h-4 w-4 text-green-600" />
                          )}
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {c.status === "active"
                                ? "Deactivate"
                                : "Activate"}{" "}
                              {c.name}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {c.status === "active"
                                ? "This coordinator will no longer be able to log in."
                                : "This coordinator will regain access to the system."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleToggleStatus(c._id, c.status)
                              }
                            >
                              {c.status === "active"
                                ? "Deactivate"
                                : "Activate"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
