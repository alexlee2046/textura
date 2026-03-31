"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { INQUIRY_STATUS } from "@/lib/constants";

type InquiryRow = {
  id: string;
  contactName: string;
  phone: string;
  company: string | null;
  message: string | null;
  status: string;
  createdAt: string;
  materialName: string | null;
  materialCategory: string | null;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  [INQUIRY_STATUS.PENDING]: { label: "待处理", variant: "secondary" },
  [INQUIRY_STATUS.CONTACTED]: { label: "已联系", variant: "default" },
  [INQUIRY_STATUS.CLOSED]: { label: "已关闭", variant: "outline" },
};

const STATUS_OPTIONS = [
  { value: INQUIRY_STATUS.PENDING, label: "待处理" },
  { value: INQUIRY_STATUS.CONTACTED, label: "已联系" },
  { value: INQUIRY_STATUS.CLOSED, label: "已关闭" },
] as const;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const limit = 50;

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const res = await fetch(`/api/dashboard/inquiries?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setInquiries(data.items);
      setTotal(data.total);
    } catch {
      toast.error("加载询盘列表失败");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  async function handleStatusChange(id: string, newStatus: string) {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/dashboard/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");

      setInquiries((prev) =>
        prev.map((inq) =>
          inq.id === id ? { ...inq, status: newStatus } : inq,
        ),
      );
      toast.success("状态已更新");
    } catch {
      toast.error("更新状态失败");
    } finally {
      setUpdatingId(null);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">询盘记录</h1>
        <p className="text-sm text-muted-foreground">
          共 {total} 条询盘
        </p>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>联系人</TableHead>
              <TableHead>电话</TableHead>
              <TableHead className="hidden md:table-cell">公司</TableHead>
              <TableHead className="hidden md:table-cell">材质名称</TableHead>
              <TableHead className="hidden lg:table-cell">留言</TableHead>
              <TableHead>日期</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="w-32">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <div className="h-10 animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))
            ) : inquiries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-12 text-center text-muted-foreground"
                >
                  暂无询盘记录
                </TableCell>
              </TableRow>
            ) : (
              inquiries.map((row) => {
                const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG[INQUIRY_STATUS.PENDING];
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.contactName}
                    </TableCell>
                    <TableCell>{row.phone}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {row.company || "---"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {row.materialName || "---"}
                    </TableCell>
                    <TableCell className="hidden max-w-48 truncate lg:table-cell">
                      {row.message || "---"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.status}
                        onValueChange={(val) => {
                          if (val) handleStatusChange(row.id, val);
                        }}
                        disabled={updatingId === row.id}
                      >
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })
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
    </div>
  );
}
