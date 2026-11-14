import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
type Point = { x: number; y: number };
type Perspective = [Point, Point, Point, Point];
type Cv = any;

async function getOpenCv(): Promise<Cv> {
  const module = await import("@techstark/opencv-js");
  const candidate: any = module.default ?? module;
  if (candidate instanceof Promise) return candidate;
  if (candidate.Mat) return candidate;
  await new Promise<void>((resolve) => {
    candidate.onRuntimeInitialized = resolve;
  });
  return candidate;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function cleanDocument(
  input: Buffer,
  perspective: Perspective,
): Promise<Buffer> {
  const cv = await getOpenCv();
  const { data, info } = await sharp(input)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgb = cv.matFromArray(
    info.height,
    info.width,
    cv.CV_8UC3,
    Array.from(data),
  );
  const source = new cv.Mat();
  cv.cvtColor(rgb, source, cv.COLOR_RGB2BGR);
  const warped = new cv.Mat();
  const denoised = new cv.Mat();
  const lab = new cv.Mat();
  const illumination = new cv.Mat();
  const correctedLightness = new cv.Mat();
  const outputLab = new cv.Mat();
  const output = new cv.Mat();
  const outputRgb = new cv.Mat();
  const channels = new cv.MatVector();
  try {
    const [topLeft, topRight, bottomRight, bottomLeft] = perspective.map(
      (point) => ({ x: point.x * info.width, y: point.y * info.height }),
    );
    const width = Math.max(
      1,
      Math.round(
        Math.max(
          distance(topLeft, topRight),
          distance(bottomLeft, bottomRight),
        ),
      ),
    );
    const height = Math.max(
      1,
      Math.round(
        Math.max(
          distance(topLeft, bottomLeft),
          distance(topRight, bottomRight),
        ),
      ),
    );
    const sourcePoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      topLeft.x,
      topLeft.y,
      topRight.x,
      topRight.y,
      bottomRight.x,
      bottomRight.y,
      bottomLeft.x,
      bottomLeft.y,
    ]);
    const targetPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0,
      width - 1,
      0,
      width - 1,
      height - 1,
      0,
      height - 1,
    ]);
    try {
      const transform = cv.getPerspectiveTransform(sourcePoints, targetPoints);
      try {
        // Rectify the user-selected quadrilateral before enhancing the document.
        cv.warpPerspective(
          source,
          warped,
          transform,
          new cv.Size(width, height),
          cv.INTER_LINEAR,
          cv.BORDER_REPLICATE,
        );
      } finally {
        transform.delete();
      }
    } finally {
      sourcePoints.delete();
      targetPoints.delete();
    }
    cv.bilateralFilter(warped, denoised, 7, 35, 35, cv.BORDER_DEFAULT);
    cv.cvtColor(denoised, lab, cv.COLOR_BGR2Lab);
    cv.split(lab, channels);
    const lightness = channels.get(0);
    // Estimate uneven illumination from a blurred lightness channel.
    cv.GaussianBlur(
      lightness,
      illumination,
      new cv.Size(0, 0),
      21,
      21,
      cv.BORDER_REPLICATE,
    );
    cv.divide(lightness, illumination, correctedLightness, 255);
    cv.normalize(
      correctedLightness,
      correctedLightness,
      35,
      255,
      cv.NORM_MINMAX,
    );
    correctedLightness.copyTo(lightness);
    cv.merge(channels, outputLab);
    cv.cvtColor(outputLab, output, cv.COLOR_Lab2BGR);
    cv.cvtColor(output, outputRgb, cv.COLOR_BGR2RGB);
    return sharp(Buffer.from(outputRgb.data), {
      raw: { width, height, channels: 3 },
    })
      .png()
      .toBuffer();
  } finally {
    rgb.delete();
    source.delete();
    warped.delete();
    denoised.delete();
    lab.delete();
    illumination.delete();
    correctedLightness.delete();
    outputLab.delete();
    output.delete();
    outputRgb.delete();
    channels.delete();
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json({ error: "缺少图片" }, { status: 400 });
    const brightness = Number(form.get("brightness") ?? 18);
    const contrast = Number(form.get("contrast") ?? 38);
    const blackPoint = Math.max(
      0,
      Math.min(100, Number(form.get("blackPoint") ?? 20)),
    );
    const sharpness = Number(form.get("sharpness") ?? 24);
    const perspective = JSON.parse(
      String(form.get("perspective")),
    ) as Perspective;
    const prepared = await sharp(Buffer.from(await file.arrayBuffer()), {
      failOn: "none",
    })
      .rotate()
      .resize({
        width: 2200,
        height: 2200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    const cleaned = await cleanDocument(prepared, perspective);
    const factor = 1 + contrast / 220;
    const { data: pixels, info } = await sharp(cleaned)
      .linear(factor, 128 * (1 - factor) + brightness * 0.35)
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Darken ink-like shadows while leaving the light paper background alone.
    for (let i = 0; i < pixels.length; i += info.channels) {
      const luminance =
        0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      const shadow = Math.max(0, (235 - luminance) / 235);
      const darken = blackPoint * 3 * Math.pow(shadow, 1.1);
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[i + channel] = Math.max(0, pixels[i + channel] - darken);
      }
    }
    const output = await sharp(pixels, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    })
      .sharpen({ sigma: 0.35 + sharpness / 80 })
      .webp({ quality: 94 })
      .toBuffer();
    return new NextResponse(output as BodyInit, {
      headers: { "Content-Type": "image/webp", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "图片处理失败" }, { status: 500 });
  }
}
