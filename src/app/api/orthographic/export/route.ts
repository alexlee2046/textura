import { NextResponse } from "next/server";
import { requireOrgWithCredits } from "@/lib/api-guard";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, rm, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { DxfWriter, Units, SplineFlags } from "@tarikjabiri/dxf";

const execFileAsync = promisify(execFile);

const FORMATS = {
  svg: { ext: "svg", contentType: "image/svg+xml" },
  pdf: { ext: "pdf", contentType: "application/pdf" },
  dxf: { ext: "dxf", contentType: "application/dxf" },
  dwg: { ext: "dwg", contentType: "application/acad" },
} as const;

type ExportFormat = keyof typeof FORMATS;

// --- SVG path -> DXF conversion (native SPLINE entities, lossless) ---

type Point2D = [number, number];

/** A segment is either a line or a cubic Bezier */
type LineSegment = { type: "line"; from: Point2D; to: Point2D };
type BezierSegment = {
  type: "bezier";
  pts: [Point2D, Point2D, Point2D, Point2D];
};
type Segment = LineSegment | BezierSegment;

/** A subpath is a sequence of segments, possibly closed */
interface SubPath {
  segments: Segment[];
  closed: boolean;
}

/** Parse all SVG <path> d-attributes into structured subpaths */
function svgPathsToSubPaths(
  svgContent: string,
  canvasHeight: number,
): SubPath[] {
  const subPaths: SubPath[] = [];
  const pathRegex = /\bd="([^"]+)"/g;
  let pathMatch;

  const flip = (x: number, y: number): Point2D => [x, canvasHeight - y];

  while ((pathMatch = pathRegex.exec(svgContent)) !== null) {
    const d = pathMatch[1];
    const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
    if (!tokens) continue;

    let segments: Segment[] = [];
    let cursor: Point2D = [0, 0];
    let subpathStart: Point2D = [0, 0];

    for (const token of tokens) {
      const cmd = token[0];
      const nums = (
        token.slice(1).match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || []
      ).map(Number);

      switch (cmd) {
        case "M":
          if (segments.length > 0) subPaths.push({ segments, closed: false });
          cursor = flip(nums[0], nums[1]);
          subpathStart = cursor;
          segments = [];
          break;
        case "m":
          if (segments.length > 0) subPaths.push({ segments, closed: false });
          cursor = [cursor[0] + nums[0], cursor[1] - nums[1]];
          subpathStart = cursor;
          segments = [];
          break;
        case "L":
          for (let i = 0; i < nums.length; i += 2) {
            const to = flip(nums[i], nums[i + 1]);
            segments.push({ type: "line", from: cursor, to });
            cursor = to;
          }
          break;
        case "l":
          for (let i = 0; i < nums.length; i += 2) {
            const to: Point2D = [cursor[0] + nums[i], cursor[1] - nums[i + 1]];
            segments.push({ type: "line", from: cursor, to });
            cursor = to;
          }
          break;
        case "C":
          for (let i = 0; i < nums.length; i += 6) {
            const p1 = flip(nums[i], nums[i + 1]);
            const p2 = flip(nums[i + 2], nums[i + 3]);
            const p3 = flip(nums[i + 4], nums[i + 5]);
            segments.push({ type: "bezier", pts: [cursor, p1, p2, p3] });
            cursor = p3;
          }
          break;
        case "c":
          for (let i = 0; i < nums.length; i += 6) {
            const p1: Point2D = [
              cursor[0] + nums[i],
              cursor[1] - nums[i + 1],
            ];
            const p2: Point2D = [
              cursor[0] + nums[i + 2],
              cursor[1] - nums[i + 3],
            ];
            const p3: Point2D = [
              cursor[0] + nums[i + 4],
              cursor[1] - nums[i + 5],
            ];
            segments.push({ type: "bezier", pts: [cursor, p1, p2, p3] });
            cursor = p3;
          }
          break;
        case "Z":
        case "z":
          if (
            cursor[0] !== subpathStart[0] ||
            cursor[1] !== subpathStart[1]
          ) {
            segments.push({ type: "line", from: cursor, to: subpathStart });
          }
          cursor = subpathStart;
          if (segments.length > 0) subPaths.push({ segments, closed: true });
          segments = [];
          break;
        default:
          console.warn(`SVG path: unsupported command "${cmd}", skipping`);
          break;
      }
    }
    if (segments.length > 0) subPaths.push({ segments, closed: false });
  }
  return subPaths;
}

/**
 * Convert subpaths to a fully-structured DXF using @tarikjabiri/dxf.
 *
 * Cubic Bezier curves map directly to degree-3 B-splines:
 * - Control points are identical (no math needed)
 * - Knot vector: [0,0,0,0, 1,1,1, 2,2,2, ..., N,N,N,N]
 *   where N = number of Bezier segments
 *
 * The library generates all required DXF sections (HEADER, CLASSES, TABLES
 * with BLOCK_RECORD, BLOCKS, ENTITIES, OBJECTS) ensuring compatibility
 * with AutoCAD 2015 and older versions.
 */
function subPathsToDxf(subPaths: SubPath[]): string {
  const dxf = new DxfWriter();
  dxf.setUnits(Units.Unitless);

  for (const subPath of subPaths) {
    let bezierRun: BezierSegment[] = [];

    const flushBezierRun = (isClosed: boolean) => {
      if (bezierRun.length === 0) return;
      const N = bezierRun.length;
      const ctrlPts = [
        { x: bezierRun[0].pts[0][0], y: bezierRun[0].pts[0][1], z: 0 },
      ];
      for (const seg of bezierRun) {
        ctrlPts.push(
          { x: seg.pts[1][0], y: seg.pts[1][1], z: 0 },
          { x: seg.pts[2][0], y: seg.pts[2][1], z: 0 },
          { x: seg.pts[3][0], y: seg.pts[3][1], z: 0 },
        );
      }
      const knots: number[] = [0, 0, 0, 0];
      for (let i = 1; i < N; i++) knots.push(i, i, i);
      knots.push(N, N, N, N);

      const flags = SplineFlags.Planar | (isClosed ? SplineFlags.Closed : 0);
      dxf.addSpline({
        controlPoints: ctrlPts,
        degreeCurve: 3,
        flags,
        knots,
      });
      bezierRun = [];
    };

    for (const seg of subPath.segments) {
      if (seg.type === "bezier") {
        bezierRun.push(seg);
      } else {
        flushBezierRun(false);
        dxf.addLine(
          { x: seg.from[0], y: seg.from[1], z: 0 },
          { x: seg.to[0], y: seg.to[1], z: 0 },
        );
      }
    }
    flushBezierRun(subPath.closed);
  }

  return dxf.stringify();
}

/**
 * POST /api/orthographic/export
 * Converts an orthographic drawing image to SVG/PDF/DXF via Potrace.
 * No credit cost -- conversion is free after the image has been generated.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireOrgWithCredits(0);
    if (auth instanceof NextResponse) return auth;

    let imageBuffer: Buffer;
    let format: string;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // FormData upload (from vectorized export)
      const formData = await req.formData();
      const imageFile = formData.get("image") as File;
      if (!imageFile) {
        return NextResponse.json(
          { error: "Missing image" },
          { status: 400 },
        );
      }
      imageBuffer = Buffer.from(await imageFile.arrayBuffer());
      format = (formData.get("format") as string) || "svg";
    } else {
      // JSON upload (existing orthographic export)
      const body = await req.json();
      const { imageUrl, format: rawFormat } = body;

      if (!imageUrl || typeof imageUrl !== "string") {
        return NextResponse.json(
          { error: "Missing required field: imageUrl" },
          { status: 400 },
        );
      }

      format = rawFormat || "svg";

      // Fetch the image
      if (imageUrl.startsWith("data:")) {
        const base64Data = imageUrl.split(",")[1];
        if (!base64Data)
          return NextResponse.json(
            { error: "Invalid data URL" },
            { status: 400 },
          );
        imageBuffer = Buffer.from(base64Data, "base64");
      } else {
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) {
          return NextResponse.json(
            { error: "Failed to fetch image" },
            { status: 400 },
          );
        }
        imageBuffer = Buffer.from(await imgRes.arrayBuffer());
      }
    }

    if (!(format in FORMATS)) {
      return NextResponse.json(
        { error: `Invalid format: ${format}. Supported: svg, pdf, dxf, dwg` },
        { status: 400 },
      );
    }
    const fmt = FORMATS[format as ExportFormat];

    const { width, height } = await sharp(imageBuffer).metadata();
    if (!width || !height) {
      return NextResponse.json(
        { error: "Could not read image dimensions" },
        { status: 400 },
      );
    }

    const workDir = join(tmpdir(), `potrace-${randomUUID()}`);
    await mkdir(workDir, { recursive: true });

    const pgmPath = join(workDir, "input.pgm");
    const pbmPath = join(workDir, "input.pbm");

    try {
      // Write PGM (P5 binary grayscale) for mkbitmap input
      const grayImg = sharp(imageBuffer).grayscale();
      const { data: rawPixels, info } = await grayImg.raw().toBuffer({ resolveWithObject: true });
      const pgmHeader = `P5\n${info.width} ${info.height}\n255\n`;
      await writeFile(pgmPath, Buffer.concat([Buffer.from(pgmHeader, "ascii"), rawPixels]));
      // mkbitmap: adaptive thresholding + resolution-aware upscale
      const minDim = Math.min(width, height);
      const upscale = minDim >= 2048 ? 1 : minDim >= 1024 ? 2 : 4;
      await execFileAsync("mkbitmap", [
        pgmPath,
        "-o",
        pbmPath,
        "-t",
        "0.45",
        "-s",
        String(upscale),
      ]);

      // Always trace to SVG first (Bezier curves, best quality)
      // DXF/DWG are derived from SVG; PDF uses potrace's native backend
      const potraceBackend = format === "pdf" ? "pdf" : "svg";
      const tracePath = join(workDir, `output.${potraceBackend}`);

      const potraceArgs = [
        pbmPath,
        "-b",
        potraceBackend,
        "-o",
        tracePath,
        "--alphamax",
        width >= 2048 ? "0.5" : "1.2",
        "--opttolerance",
        "0.05",
        "--turdsize",
        width >= 2048 ? "8" : "4",
      ];

      if (format === "pdf") {
        potraceArgs.push("-r", "150");
      }

      await execFileAsync("potrace", potraceArgs);

      let output: Buffer;

      if (format === "dxf" || format === "dwg") {
        // Convert SVG Bezier paths -> DXF with native SPLINE entities (lossless)
        const svgContent = (await readFile(tracePath)).toString("utf-8");
        const dimMatch = svgContent.match(
          /width="([\d.]+)pt"\s+height="([\d.]+)pt"/,
        );
        const svgH = dimMatch ? parseFloat(dimMatch[2]) : height;
        const subPaths = svgPathsToSubPaths(svgContent, svgH);
        const dxfContent = subPathsToDxf(subPaths);

        if (format === "dwg") {
          // DXF (with SPLINEs) -> DWG R2000 via LibreDWG dwgwrite
          const dxfPath = join(workDir, "output.dxf");
          const dwgPath = join(workDir, "output.dwg");
          await writeFile(dxfPath, dxfContent, "utf-8");
          await execFileAsync("dwgwrite", [
            "-I",
            "DXF",
            "--as",
            "r2000",
            "-y",
            "-o",
            dwgPath,
            dxfPath,
          ]);
          output = await readFile(dwgPath);
        } else {
          output = Buffer.from(dxfContent, "utf-8");
        }
      } else if (format === "svg") {
        let svg = (await readFile(tracePath)).toString("utf-8");
        svg = svg.replace(
          /width="([\d.]+)pt"\s+height="([\d.]+)pt"/,
          (_match, w, h) =>
            `width="100%" height="100%" viewBox="0 0 ${w} ${h}"`,
        );
        output = Buffer.from(svg, "utf-8");
      } else {
        output = await readFile(tracePath);
      }

      const filename = `orthographic_${Date.now()}.${fmt.ext}`;
      return new Response(new Uint8Array(output), {
        status: 200,
        headers: {
          "Content-Type": fmt.contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  } catch (error: unknown) {
    console.error("Error exporting orthographic:", error);
    const message =
      error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
