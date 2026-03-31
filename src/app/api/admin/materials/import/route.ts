import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/dal";
import { MATERIAL_CATEGORIES, MATERIAL_STATUS } from "@/lib/constants";

type CsvRow = {
  name: string;
  category: string;
  seriesCode?: string;
  color?: string;
  colorCode?: string;
  promptModifier?: string;
};

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const categoryIdx = headers.indexOf("category");
  const seriesCodeIdx = headers.indexOf("series_code");
  const colorIdx = headers.indexOf("color");
  const colorCodeIdx = headers.indexOf("color_code");
  const promptIdx = headers.indexOf("prompt_modifier");

  if (nameIdx === -1 || categoryIdx === -1) {
    throw new Error("CSV must have 'name' and 'category' columns");
  }

  const validCategories = MATERIAL_CATEGORIES.map((c) => c.key) as readonly string[];

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const name = cols[nameIdx];
    const category = cols[categoryIdx];

    if (!name || !category) continue;
    if (!validCategories.includes(category)) continue;

    rows.push({
      name,
      category,
      seriesCode: seriesCodeIdx >= 0 ? cols[seriesCodeIdx] || undefined : undefined,
      color: colorIdx >= 0 ? cols[colorIdx] || undefined : undefined,
      colorCode: colorCodeIdx >= 0 ? cols[colorCodeIdx] || undefined : undefined,
      promptModifier: promptIdx >= 0 ? cols[promptIdx] || undefined : undefined,
    });
  }

  return rows;
}

// POST /api/admin/materials/import — bulk import materials from CSV
export async function POST(request: NextRequest) {
  try {
    const admin = await requirePlatformAdmin();

    const body = await request.json();
    const { csv, orgId } = body as { csv?: string; orgId?: string };

    if (!csv || !orgId) {
      return NextResponse.json(
        { error: "csv and orgId are required" },
        { status: 400 },
      );
    }

    // Verify org exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    let rows: CsvRow[];
    try {
      rows = parseCsv(csv);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid CSV" },
        { status: 400 },
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV" },
        { status: 400 },
      );
    }

    // Bulk create in transaction
    const created = await prisma.$transaction(async (tx) => {
      const materials = [];
      for (const row of rows) {
        const mat = await tx.material.create({
          data: {
            organizationId: orgId,
            name: row.name,
            category: row.category,
            seriesCode: row.seriesCode ?? null,
            color: row.color ?? null,
            colorCode: row.colorCode ?? null,
            promptModifier: row.promptModifier ?? "",
            status: MATERIAL_STATUS.ACTIVE,
            createdBy: admin.userId,
          },
        });
        materials.push(mat);
      }
      return materials;
    });

    return NextResponse.json(
      { imported: created.length, total: rows.length },
      { status: 201 },
    );
  } catch (error) {
    throw error;
  }
}
