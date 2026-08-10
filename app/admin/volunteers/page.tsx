"use client";

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/authClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { Plus, Users, Pencil, Search, Copy, Check, Eye } from "lucide-react";
import { RefreshButton } from "@/components/refresh-button";
import { VolunteerDetailsDialog } from "@/components/volunteer-details-dialog";

const SKILLS = [
  "medical",
  "photography",
  "videography",
  "driving",
  "electrical",
  "sound",
  "it",
  "graphic_design",
  "cooking",
  "crowd_management",
  "other",
] as const;

const GENDERS = ["male", "female", "other"] as const;

const skillLabels: Record<string, string> = {
  medical: "Medical",
  photography: "Photography",
  videography: "Videography",
  driving: "Driving",
  electrical: "Electrical",
  sound: "Sound",
  it: "IT / Tech",
  graphic_design: "Graphic Design",
  cooking: "Cooking",
  crowd_management: "Crowd Management",
  other: "Other",
};

interface Volunteer {
  _id: string;
  volunteerNumber: string;
  name: string;
  phone: string;
  whatsappNumber?: string;
  age?: number;
  gender?: string;
  locality?: string;
  occupation?: string;
  skills?: string[];
  sevaToken?: string;
  notes?: string;
  createdAt: string;
}

const emptyForm = {
  name: "",
  whatsapp: "",
  age: "",
  gender: "",
  locality: "",
  occupation: "",
  skills: [] as string[],
  notes: "",
};

export default function VolunteersPage() {
  const { user } = useAuth();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Volunteer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Volunteer | null>(null);

  const fetchVolunteers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (genderFilter) params.set("gender", genderFilter);
      if (skillFilter) params.set("skills", skillFilter);
      const res = await authFetch(`/api/volunteers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setVolunteers(data.volunteers);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        toast.error("Failed to load volunteers");
      }
    } catch {
      toast.error("Failed to load volunteers");
    } finally {
      setLoading(false);
    }
  }, [page, search, genderFilter, skillFilter]);

  useEffect(() => {
    fetchVolunteers();
  }, [fetchVolunteers]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, genderFilter, skillFilter]);

  const toggleSkill = (skill: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.whatsapp) {
      toast.error("Name and WhatsApp number are required");
      return;
    }
    setSubmitting(true);
    try {
      const url = editing ? `/api/volunteers/${editing._id}` : "/api/volunteers";
      const method = editing ? "PUT" : "POST";
      const body = {
        name: form.name,
        phone: form.whatsapp,
        whatsappNumber: form.whatsapp,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        locality: form.locality || undefined,
        occupation: form.occupation || undefined,
        skills: form.skills,
        notes: form.notes || undefined,
      };
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(editing ? "Volunteer updated" : "Volunteer created");
        setDialogOpen(false);
        resetForm();
        fetchVolunteers();
      } else {
        toast.error(data.message || "Something went wrong");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (v: Volunteer) => {
    setEditing(v);
    setForm({
      name: v.name,
      whatsapp: v.phone,
      age: v.age !== undefined ? String(v.age) : "",
      gender: v.gender || "",
      locality: v.locality || "",
      occupation: v.occupation || "",
      skills: v.skills || [],
      notes: v.notes || "",
    });
    setDialogOpen(true);
  };

  const copySevaToken = async (v: Volunteer) => {
    if (!v.sevaToken) return;
    try {
      await navigator.clipboard.writeText(v.sevaToken);
      setCopiedId(v._id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Could not copy token");
    }
  };

  if (
    user?.role !== "super_admin" &&
    user?.role !== "event_coordinator"
  ) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">
          Volunteer management requires event coordinator access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Volunteers</h1>
          <p className="text-sm text-muted-foreground">
            Registered volunteers across all events
          </p>
        </div>
        <div className="flex items-center gap-2">
        <RefreshButton
          onRefresh={fetchVolunteers}
          loading={loading}
          title="Refresh volunteers"
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
            Add Volunteer
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Volunteer" : "Add Volunteer"}
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto py-2 pr-1">
              <div className="grid gap-4 sm:grid-cols-2">
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
                  <Label>WhatsApp Number</Label>
                  <Input
                    type="tel"
                    value={form.whatsapp}
                    onChange={(e) =>
                      setForm({ ...form, whatsapp: e.target.value })
                    }
                    placeholder="+91 9876543210"
                    disabled={!!editing}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Age</Label>
                  <Input
                    type="number"
                    min={13}
                    max={100}
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    placeholder="e.g. 25"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={form.gender || null}
                    onValueChange={(v) => {
                      if (v) setForm({ ...form, gender: v });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Locality</Label>
                  <Input
                    value={form.locality}
                    onChange={(e) =>
                      setForm({ ...form, locality: e.target.value })
                    }
                    placeholder="e.g. MVP Colony"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Occupation</Label>
                <Input
                  value={form.occupation}
                  onChange={(e) =>
                    setForm({ ...form, occupation: e.target.value })
                  }
                  placeholder="e.g. Software Engineer"
                />
              </div>
              <div className="space-y-2">
                <Label>Skills</Label>
                <div className="flex flex-wrap gap-2">
                  {SKILLS.map((skill) => {
                    const active = form.skills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-transparent text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {skillLabels[skill]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  placeholder="Any notes about this volunteer"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? "Saving..."
                  : editing
                    ? "Update Volunteer"
                    : "Create Volunteer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name, number or locality..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select
          value={skillFilter || null}
          onValueChange={(v) => {
            if (v && v !== "__all") setSkillFilter(v);
            else setSkillFilter("");
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All skills" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All skills</SelectItem>
            {SKILLS.map((skill) => (
              <SelectItem key={skill} value={skill}>
                {skillLabels[skill]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={genderFilter || null}
          onValueChange={(v) => {
            if (v && v !== "__all") setGenderFilter(v);
            else setGenderFilter("");
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All genders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All genders</SelectItem>
            {GENDERS.map((g) => (
              <SelectItem key={g} value={g}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : volunteers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">No volunteers found</p>
          <p className="text-sm text-muted-foreground">
            {search || genderFilter || skillFilter
              ? "Try adjusting your search or filters"
              : "Add volunteers to get started"}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Locality</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Seva Token</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {volunteers.map((v) => (
                <TableRow key={v._id}>
                  <TableCell className="font-mono text-xs">
                    {v.volunteerNumber}
                  </TableCell>
                  <TableCell className="font-medium">
                    {v.name}
                    {v.occupation && (
                      <span className="block text-xs text-muted-foreground">
                        {v.occupation}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{v.phone}</TableCell>
                  <TableCell>{v.age ?? "—"}</TableCell>
                  <TableCell className="capitalize">{v.gender || "—"}</TableCell>
                  <TableCell>{v.locality || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(v.skills || []).length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        (v.skills || []).map((s) => (
                          <Badge key={s} variant="outline">
                            {skillLabels[s] || s}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {v.sevaToken ? (
                      <button
                        type="button"
                        onClick={() => copySevaToken(v)}
                        className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary"
                        title="Copy seva token"
                      >
                        {v.sevaToken.slice(0, 8)}...
                        {copiedId === v._id ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewing(v)}
                        title="View full details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(v)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {volunteers.length} of {total} volunteers
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <VolunteerDetailsDialog
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
        volunteer={viewing}
      />
    </div>
  );
}
