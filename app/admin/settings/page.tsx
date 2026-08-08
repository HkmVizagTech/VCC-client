"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Settings, User, Building2, MessageCircle, Info } from "lucide-react";

const whatsappTemplates = [
  {
    label: "Assignment Notification",
    description: "Sent when a volunteer is assigned to a service",
    template: `Hare Krishna {name} Prabhu/Mataji,

You have been assigned to *{serviceName}* for *{eventName}*.

Date: {eventDate}
Reporting Time: {reportingTime}
Location: {location}

Please confirm your availability by replying YES to this message.

Hare Krishna!
- VCC, HKM Visakhapatnam`,
  },
  {
    label: "Reminder",
    description: "Sent one day before the event",
    template: `Hare Krishna {name} Prabhu/Mataji,

This is a gentle reminder that you are assigned to *{serviceName}* for *{eventName}* happening tomorrow.

Reporting Time: {reportingTime}
Location: {location}

Looking forward to your enthusiastic participation!

Hare Krishna!
- VCC, HKM Visakhapatnam`,
  },
  {
    label: "Thank You",
    description: "Sent after attendance is marked",
    template: `Hare Krishna {name} Prabhu/Mataji,

Thank you for your wonderful seva at *{eventName}*!

Your service in *{serviceName}* is truly appreciated. May Lord Krishna bless you abundantly.

We look forward to your continued service.

Hare Krishna!
- VCC, HKM Visakhapatnam`,
  },
];

export default function SettingsPage() {
  const { user } = useAuth();

  if (user?.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">
          Settings are only accessible to super admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          System configuration and templates
        </p>
      </div>

      {/* System Info */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">System Information</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-muted-foreground">Application</Label>
            <p className="font-medium">VCC - Volunteer Care Cell</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">Organization</Label>
            <p className="font-medium">Hare Krishna Movement Visakhapatnam</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">Version</Label>
            <p className="font-medium">1.0.0</p>
          </div>
        </div>
      </div>

      {/* Current User */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Current User</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-muted-foreground">Name</Label>
            <p className="font-medium">{user.name}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">Email</Label>
            <p className="font-medium">{user.email}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">Role</Label>
            <div>
              <Badge className="capitalize">
                {user.role.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Message Templates */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">
            WhatsApp Message Templates
          </h2>
          <Badge variant="secondary" className="ml-auto">
            Read-only
          </Badge>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Default message templates used for volunteer communications.
          Variables in curly braces are replaced with actual values at send time.
        </p>
        <div className="space-y-4">
          {whatsappTemplates.map((tmpl) => (
            <div key={tmpl.label} className="rounded-md border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium">{tmpl.label}</h3>
                <span className="text-xs text-muted-foreground">
                  {tmpl.description}
                </span>
              </div>
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm leading-relaxed">
                {tmpl.template}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
