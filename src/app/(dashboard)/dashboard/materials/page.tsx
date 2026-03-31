"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MaterialForm,
  type MaterialFormData,
} from "@/components/dashboard/material-form";
import { MATERIAL_CATEGORIES, MATERIAL_STATUS } from "@/lib/constants";

type MaterialRow = {
  id: string;
  name: string;
  category: string;
  seriesCode: string | null;
  color: string | null;
  colorCode: string | null;
  promptModifier: string;
  status: string;
  sortOrder: number;
  createdAt: string;
  imageUrl: string | null;
  imageId: string | null;
};

const categoryLabel = (key: string) =>
  MATERIAL_CATEGORIES.find((c) => c.key === key)?.label ?? key;

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editData, setEditData] = useState<MaterialFormData | undefined>();

  // Delete dialog state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const res = await fetch(`/api/dashboard/materials?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMaterials(data.items);
      setTotal(data.total);
    } catch {
      toast.error("加载材质列表失败");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  function handleCreate() {
    setFormMode("create");
    setEditData(undefined);
    setFormOpen(true);
  }

  function handleEdit(row: MaterialRow) {
    setFormMode("edit");
    setEditData({
      id: row.id,
      category: row.category,
      name: row.name,
      seriesCode: row.seriesCode ?? "",
      color: row.color ?? "",
      colorCode: row.colorCode ?? "",
      promptModifier: row.promptModifier,
      imageUrl: row.imageUrl,
    });
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/materials/${deleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("材质已删除");
      setDeleteId(null);
      fetchMaterials();
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">材质管理</h1>
          <p className="text-sm text-muted-foreground">
            共 {total} 项材质
          </p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          添加材质
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">图片</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>分类</TableHead>
              <TableHead className="hidden md:table-cell">系列编号</TableHead>
              <TableHead className="hidden md:table-cell">颜色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <div className="h-10 animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))
            ) : materials.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-muted-foreground"
                >
                  暂无材质，点击右上角「添加材质」开始
                </TableCell>
              </TableRow>
            ) : (
              materials.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.imageUrl ? (
                      <Image
                        src={row.imageUrl}
                        alt={row.name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-md object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{categoryLabel(row.category)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {row.seriesCode || "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="flex items-center gap-1.5">
                      {row.colorCode && (
                        <span
                          className="inline-block h-4 w-4 rounded-full border border-border"
                          style={{ backgroundColor: row.colorCode }}
                        />
                      )}
                      {row.color || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === MATERIAL_STATUS.ACTIVE
                          ? "default"
                          : "secondary"
                      }
                    >
                      {row.status === MATERIAL_STATUS.ACTIVE ? "上架" : "归档"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon" className="h-8 w-8" />
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">操作</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(row)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteId(row.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <MaterialForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialData={editData}
        onSuccess={fetchMaterials}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除此材质吗？删除后可以联系管理员恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
