"use client";

import { Printer } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrintPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:px-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Export</h2>
        <p className="text-sm text-[var(--muted)]">
          Match pack PDF / print — kept visible for the desk workflow.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="h-4 w-4 text-teal-600" />
            Coming soon
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-[var(--muted)]">
          <p>
            Export is on the roadmap. No fake pack or print preview here —
            when it ships, you will select squads, speaks, unavailable, and
            checklist sections and save a CoComms match PDF.
          </p>
          <p className="text-xs">
            For now use Research notes and the live desk. —
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
