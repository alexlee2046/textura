"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MATERIAL_CATEGORIES, MATERIAL_STATUS } from "@/lib/constants";

type OrgOption = {
  id: string;
  name: string;
  slug: string;
};

type MaterialRow = {
  id: string;
  name: string;
  category: string;
  seriesCode: string | null;
  status: string;
  createdAt: string;
  organization: { name: string; slug: string };
};

const categoryLabel = (key: string) =>
  MATERIAL_CATEGORIES.find((c) => c.key === key)?.label ?? key;

export default function AdminMaterialsPage() {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("all");

  // Import dialog state
  const [importOpen, setImportOpen] = useState(false);
  const [importOrgId, setImportOrgId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/organizations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrgs(
        data.items.map((o: OrgOption) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
        })),
      );
    } catch {
      // orgs may fail to load, non-critical for material list
    }
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const fetchAllMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (orgFilter !== "all") params.set("orgId", orgFilter);

      const res = await fetch(`/api/admin/materials?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMaterials(data.items);
    } catch {
      toast.error("Failed to load materials");
    } finally {
      setLoading(false);
    }
  }, [search, orgFilter]);

  useEffect(() => {
    fetchAllMaterials();
  }, [fetchAllMaterials]);

  async function handleImport() {
    if (!importOrgId || !csvText.trim()) {
      toast.error("Organization and CSV data are required");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/admin/materials/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, orgId: importOrgId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Import failed");
      }

      const data = await res.json();
      toast.success(`Imported ${data.imported} materials`);
      setImportOpen(false);
      setCsvText("");
      setImportOrgId("");
      fetchAllMaterials();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const filtered = materials;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Materials</h1>
          <p className="text-sm text-muted-foreground">
            All materials across organizations
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)} size="sm">
          <Upload className="mr-1.5 h-4 w-4" />
          CSV Import
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={orgFilter} onValueChange={(v) => v && setOrgFilter(v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All organizations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All organizations</SelectItem>
            {orgs.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Materials</CardTitle>
          <CardDescription>
            {filtered.length} material{filtered.length !== 1 && "s"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden md:table-cell">
                  Series Code
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <div className="h-8 animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No materials found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {row.organization.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{categoryLabel(row.category)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {row.seriesCode || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === MATERIAL_STATUS.ACTIVE
                            ? "default"
                            : "secondary"
                        }
                      >
                        {row.status === MATERIAL_STATUS.ACTIVE
                          ? "Active"
                          : "Archived"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CSV Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Materials from CSV</DialogTitle>
            <DialogDescription>
              Paste CSV text with columns: name, category, series_code, color,
              color_code, prompt_modifier. Required: name, category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select value={importOrgId} onValueChange={(v) => v && setImportOrgId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CSV Data</Label>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`name,category,series_code,color\nSilk White,fabric,SW-001,White`}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportOpen(false)}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
