"use client";

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/authClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, HeartHandshake } from "lucide-react";
import { RefreshButton } from "@/components/refresh-button";

interface Devotee {
  _id: string;
  name: string;
  phone?: string;
  notes?: string;
}

const emptyForm = { name: "", phone: "", notes: "" };

export default function DevoteesPage() {
  const [devotees, setDevotees] = useState<Devotee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Devotee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const fetchDevotees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/devotees");
      if (res.ok) {
        const data = await res.json();
        setDevotees(data.devotees || []);
      } else {
        toast.error("Failed to load devotees");
      }
    } catch {
      toast.error("Failed to load devotees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevotees();
  }, [fetchDevotees]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const url = editing ? `/api/devotees/${editing._id}` : "/api/devotees";
      const method = editing ? "PUT" : "POST";
      const res = await authFetch(url, {
        method,
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(editing ? "Devotee updated" : "Devotee added");
        setDialogOpen(false);
        resetForm();
        fetchDevotees();
      } else {
        toast.error(data.message || "Something went wrong");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (devotee: Devotee) => {
    try {
      const res = await authFetch(`/api/devotees/${devotee._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Devotee removed");
        fetchDevotees();
      } else {
        const data = await res.json();
        toast.error(data.message || "Could not delete");
      }
    } catch {
      toast.error("Could not delete devotee");
    }
  };

  const openEdit = (devotee: Devotee) => {
    setEditing(devotee);
    setForm({
      name: devotee.name,
      phone: devotee.phone || "",
      notes: devotee.notes || "",
    });
    setDialogOpen(true);
  };

  const filtered = devotees.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.phone || "").includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Devotees</h1>
          <p className="text-sm text-muted-foreground">
            Manage the list of devotees volunteers can select during registration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton
            onRefresh={fetchDevotees}
            loading={loading}
            title="Refresh devotees"
          />
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger
              render={
                <Button onClick={() => setDialogOpen(true)} />
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Devotee
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Devotee" : "Add Devotee"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Ramachandra Das"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })
                    }
                    placeholder="10-digit number (optional)"
                    maxLength={10}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Any additional info"
                  />
                </div>
                <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Saving..." : editing ? "Update Devotee" : "Add Devotee"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div>
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <HeartHandshake className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">
            {search ? "No devotees match your search" : "No devotees yet"}
          </p>
          {!search && (
            <p className="text-sm text-muted-foreground">
              Add devotees so volunteers can select them during registration
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((devotee) => (
                <TableRow key={devotee._id}>
                  <TableCell className="font-medium">{devotee.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {devotee.phone || "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {devotee.notes || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(devotee)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button variant="ghost" size="icon" title="Delete" />
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Remove &ldquo;{devotee.name}&rdquo;?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This devotee will be removed from the list. Existing registrations that already selected this devotee will not be affected.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(devotee)}>
                              Remove
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
