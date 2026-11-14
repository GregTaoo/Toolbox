"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Card,
  Chip,
  Container,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Slider,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DocumentScannerRoundedIcon from "@mui/icons-material/DocumentScannerRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import RotateRightRoundedIcon from "@mui/icons-material/RotateRightRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import { jsPDF } from "jspdf";

type Point = { x: number; y: number };
type Perspective = [Point, Point, Point, Point];
type Settings = {
  brightness: number;
  contrast: number;
  blackPoint: number;
  sharpness: number;
};
type Photo = {
  id: string;
  file: File;
  original: string;
  processed?: string;
  perspective: Perspective;
  rotation: number;
};
const defaults: Settings = {
  brightness: 18,
  contrast: 38,
  blackPoint: 20,
  sharpness: 24,
};
const defaultPerspective = (): Perspective => [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

function rotatePerspective(points: Perspective, rotation: number): Perspective {
  let result = points;
  for (let turn = 0; turn < rotation / 90; turn += 1) {
    result = result.map((point) => ({ x: 1 - point.y, y: point.x })) as Perspective;
  }
  return result;
}

async function rotateFile(file: File, rotation: number): Promise<File> {
  if (!rotation) return file;
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("无法读取图片")); });
  URL.revokeObjectURL(url);
  const canvas = document.createElement("canvas");
  const quarterTurn = rotation % 180 !== 0;
  canvas.width = quarterTurn ? image.naturalHeight : image.naturalWidth;
  canvas.height = quarterTurn ? image.naturalWidth : image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob ? new File([blob], file.name, { type: "image/png" }) : file;
}

function PerspectiveEditor({
  image,
  points,
  rotation,
  onChange,
}: {
  image: string;
  points: Perspective;
  rotation: number;
  onChange: (points: Perspective) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<number | null>(null);
  useEffect(() => {
    if (!frameRef.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);
  const scale =
    natural.w && natural.h
      ? Math.min((size.w - 32) / natural.w, (size.h - 32) / natural.h)
      : 0;
  const movePoint = (clientX: number, clientY: number) => {
    const index = activeRef.current;
    const frame = canvasRef.current;
    if (index === null || !frame) return;
    const rect = frame.getBoundingClientRect();
    const q = {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
    const turns = rotation / 90;
    const next = turns === 1 ? { x: q.y, y: 1 - q.x } : turns === 2 ? { x: 1 - q.x, y: 1 - q.y } : turns === 3 ? { x: 1 - q.y, y: q.x } : q;
    onChange(
      points.map((point, pointIndex) =>
        pointIndex === index ? next : point,
      ) as Perspective,
    );
  };
  const stopDragging = () => {
    activeRef.current = null;
    setActive(null);
  };
  return (
    <Box
      ref={frameRef}
      onPointerMove={(event) => movePoint(event.clientX, event.clientY)}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      sx={{
        flex: 1,
        minHeight: { xs: 390, lg: 560 },
        display: "grid",
        placeItems: "center",
        p: 2,
        background: "#f1f2f7",
        borderRadius: 2,
        overflow: "visible",
        touchAction: "none",
      }}
    >
      <Box
        ref={canvasRef}
        onPointerMove={(event) => movePoint(event.clientX, event.clientY)}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        sx={{
          position: "relative",
          width: natural.w ? natural.w * scale : "100%",
          height: natural.h ? natural.h * scale : "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          lineHeight: 0,
          borderRadius: 0,
          overflow: "visible",
          transform: `rotate(${rotation}deg)`,
          boxShadow: "0 10px 28px rgba(32,38,70,.12)",
        }}
      >
        <img
          src={image}
          alt="待扫描文档"
          onLoad={(event) =>
            setNatural({
              w: event.currentTarget.naturalWidth,
              h: event.currentTarget.naturalHeight,
            })
          }
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "contain",
            borderRadius: 0,
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <polygon
            points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="rgba(99,91,255,.2)"
            stroke="#635bff"
            strokeWidth=".008"
          />
        </svg>
        {points.map((point, index) => (
          <button
            key={index}
            type="button"
            aria-label={`调整第 ${index + 1} 个角点`}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              activeRef.current = index;
              setActive(index);
            }}
            style={{
              position: "absolute",
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
              transform: "translate(-50%,-50%)",
              width: 32,
              height: 32,
              borderRadius: "50%",
              border:
                active === index ? "4px solid #4338ca" : "3px solid #635bff",
              background: "#fff",
              cursor: "grab",
              touchAction: "none",
              zIndex: 2,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

export default function ScannerPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState(0);
  const [settings, setSettings] = useState(defaults);
  const [result, setResult] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const current = photos[selected];
  const addFiles = (files: FileList | File[]) =>
    setPhotos((old) => [
      ...old,
      ...Array.from(files)
        .filter((file) => file.type.startsWith("image/"))
        .map((file) => ({
          id: crypto.randomUUID(),
          file,
          original: URL.createObjectURL(file),
          perspective: defaultPerspective(),
          rotation: 0,
        })),
    ]);
  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  };
  const onDropFiles = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };
  const clear = () => {
    photos.forEach((photo) => {
      URL.revokeObjectURL(photo.original);
      if (photo.processed) URL.revokeObjectURL(photo.processed);
    });
    setPhotos([]);
    setSelected(0);
    setResult(false);
  };
  const updatePerspective = (points: Perspective) =>
    setPhotos((old) =>
      old.map((photo, index) =>
        index === selected ? { ...photo, perspective: points } : photo,
      ),
    );
  const rotateCurrent = () =>
    setPhotos((old) =>
      old.map((photo, index) =>
        index === selected
          ? {
              ...photo,
              rotation: (photo.rotation + 90) % 360,
            }
          : photo,
      ),
    );
  const reorder = (from: number, to: number) =>
    setPhotos((old) => {
      const next = [...old];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setSelected(to);
      return next;
    });
  const process = async () => {
    setProcessing(true);
    try {
      const output = await Promise.all(
        photos.map(async (photo) => {
          const body = new FormData();
          const file = await rotateFile(photo.file, photo.rotation);
          body.append("file", file);
          body.append("perspective", JSON.stringify(rotatePerspective(photo.perspective, photo.rotation)));
          Object.entries(settings).forEach(([key, value]) =>
            body.append(key, String(value)),
          );
          const response = await fetch("/api/scan", { method: "POST", body });
          if (!response.ok) throw new Error("处理失败");
          return {
            ...photo,
            processed: URL.createObjectURL(await response.blob()),
          };
        }),
      );
      setPhotos(output);
      setResult(true);
    } finally {
      setProcessing(false);
    }
  };
  const downloadImage = () => {
    if (!current?.processed) return;
    const anchor = document.createElement("a");
    anchor.href = current.processed;
    anchor.download = `${current.file.name.replace(/\.[^.]+$/, "")}-scan.webp`;
    anchor.click();
  };
  const downloadPdf = async () => {
    if (!photos.length) return;
    const pdf = new jsPDF({ unit: "px", format: "a4" });
    for (let index = 0; index < photos.length; index += 1) {
      if (index) pdf.addPage();
      const image = new window.Image();
      image.src = photos[index].processed!;
      await new Promise((resolve) => {
        image.onload = resolve;
      });
      const scale = Math.min(
        (pdf.internal.pageSize.getWidth() - 36) / image.width,
        (pdf.internal.pageSize.getHeight() - 36) / image.height,
      );
      const width = image.width * scale;
      const height = image.height * scale;
      pdf.addImage(
        image,
        "WEBP",
        (pdf.internal.pageSize.getWidth() - width) / 2,
        (pdf.internal.pageSize.getHeight() - height) / 2,
        width,
        height,
      );
    }
    pdf.save("toolbox-scan.pdf");
  };
  const controls: Array<[keyof Settings, string, string]> = [
    ["brightness", "亮度", "提亮纸张"],
    ["contrast", "对比度", "增强文字"],
    ["blackPoint", "黑点", "增强笔迹"],
    ["sharpness", "锐化", "强化边缘"],
  ];
  return (
    <Box sx={{ minHeight: "100vh", background: "#f7f8fc" }}>
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: "1px solid #e8eaf2" }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ gap: 2, minHeight: 72 }}>
            <Button
              component={Link}
              href="/"
              startIcon={<ArrowBackRoundedIcon />}
              color="inherit"
            >
              Toolbox
            </Button>
            <Divider orientation="vertical" flexItem sx={{ my: 2 }} />
            <Typography fontWeight={800}>图片扫描</Typography>
            <Box sx={{ flex: 1 }} />
            <Chip
              label={result ? "处理完成" : "准备就绪"}
              color={result ? "success" : "default"}
              size="small"
            />
          </Toolbar>
        </Container>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={0.75} sx={{ mb: 3 }}>
          <Typography variant="overline" color="primary" fontWeight={800}>
            IMAGE SCANNER
          </Typography>
          <Typography
            variant="h3"
            sx={{ fontSize: { xs: "2rem", md: "3rem" }, lineHeight: 1.15 }}
          >
            {result ? "扫描结果" : "把纸张变成清晰扫描件"}
          </Typography>
          <Typography color="text.secondary">
            上传图片，调整边界与参数，一键导出高质量文档。
          </Typography>
        </Stack>
        {processing && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} />}
        {!photos.length ? (
          <Card
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={onDropFiles}
            sx={{
              minHeight: 430,
              display: "grid",
              placeItems: "center",
              borderStyle: "dashed",
              borderColor: dragging ? "primary.main" : undefined,
              backgroundColor: dragging ? "#f0efff" : undefined,
            }}
          >
            <Stack
              alignItems="center"
              spacing={2}
              sx={{ p: 4, textAlign: "center" }}
            >
              <Box
                sx={{
                  width: 76,
                  height: 76,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  color: "primary.main",
                  background: "#ecebff",
                }}
              >
                <CloudUploadRoundedIcon fontSize="large" />
              </Box>
              <Typography variant="h5" fontWeight={800}>
                拖入图片开始扫描
              </Typography>
              <Typography color="text.secondary">
                支持 JPG、PNG 等常见图片格式，可一次选择多张
              </Typography>
              <Button
                component="label"
                variant="contained"
                startIcon={<AddRoundedIcon />}
              >
                选择图片
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onInput}
                />
              </Button>
            </Stack>
          </Card>
        ) : result ? (
          <ResultView
            photos={photos}
            selected={selected}
            setSelected={setSelected}
            current={current}
            onBack={() => setResult(false)}
            downloadImage={downloadImage}
            downloadPdf={downloadPdf}
            reorder={reorder}
          />
        ) : (
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2.5}
            sx={{ minHeight: 620 }}
          >
            <Card sx={{ flex: 1, p: { xs: 1.5, md: 2.5 }, minWidth: 0 }}>
              <Stack spacing={2} sx={{ height: "100%" }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      icon={<DocumentScannerRoundedIcon />}
                      label={`${photos.length} 张图片`}
                      color="primary"
                      variant="outlined"
                    />
                    <Typography color="text.secondary">
                      拖动角点校正边界
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton
                      onClick={rotateCurrent}
                      aria-label="顺时针旋转"
                      title="顺时针旋转"
                    >
                      <RotateRightRoundedIcon />
                    </IconButton>
                    <IconButton onClick={clear} aria-label="清空" title="清空">
                      <DeleteOutlineRoundedIcon />
                    </IconButton>
                  </Stack>
                </Stack>
                <PerspectiveEditor
                  image={current.original}
                  points={current.perspective}
                  rotation={current.rotation}
                  onChange={updatePerspective}
                />
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<AddRoundedIcon />}
                  sx={{ minHeight: 48 }}
                >
                  继续添加图片
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={onInput}
                  />
                </Button>
                <Thumbs
                  photos={photos}
                  selected={selected}
                  setSelected={setSelected}
                  reorder={reorder}
                />
              </Stack>
            </Card>
            <SettingsPanel
              settings={settings}
              setSettings={setSettings}
              controls={controls}
              process={process}
              processing={processing}
            />
          </Stack>
        )}
      </Container>
    </Box>
  );
}

function Thumbs({
  photos,
  selected,
  setSelected,
  reorder,
}: {
  photos: Photo[];
  selected: number;
  setSelected: (index: number) => void;
  reorder: (from: number, to: number) => void;
}) {
  const dragIndex = useRef<number | null>(null);
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ overflowX: "auto", pb: 1, minHeight: 80 }}
    >
      {photos.map((photo, index) => (
        <Box
          component="button"
          type="button"
          draggable
          key={photo.id}
          onClick={() => setSelected(index)}
          onDragStart={() => {
            dragIndex.current = index;
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (dragIndex.current !== null && dragIndex.current !== index)
              reorder(dragIndex.current, index);
            dragIndex.current = null;
          }}
          sx={{
            position: "relative",
            flex: "0 0 96px",
            height: 72,
            p: 0.5,
            borderRadius: 1.5,
            border:
              index === selected ? "2px solid #635bff" : "1px solid #e3e5ee",
            background: "#fff",
            cursor: "grab",
            overflow: "hidden",
            touchAction: "none",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <img
            src={photo.processed || photo.original}
            alt={`第 ${index + 1} 张`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              borderRadius: 6,
              pointerEvents: "none",
            }}
          />
          <DragIndicatorRoundedIcon
            sx={{
              position: "absolute",
              right: 2,
              bottom: 2,
              fontSize: 18,
              color: "#fff",
              filter: "drop-shadow(0 1px 2px #000)",
            }}
          />
        </Box>
      ))}
    </Stack>
  );
}
function SettingsPanel({
  settings,
  setSettings,
  controls,
  process,
  processing,
}: any) {
  return (
    <Card
      sx={{
        width: { xs: "100%", lg: 360 },
        p: { xs: 2.5, md: 3 },
        flexShrink: 0,
        alignSelf: "flex-start",
      }}
    >
      <Stack spacing={2.5}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="h6" fontWeight={800}>
            扫描参数
          </Typography>
          <Button size="small" onClick={() => setSettings(defaults)}>
            重置
          </Button>
        </Stack>
        {controls.map(
          ([key, label, hint]: [keyof Settings, string, string]) => (
            <Box key={key}>
              <Stack direction="row" justifyContent="space-between">
                <Typography>{label}</Typography>
                <Typography color="primary" fontWeight={700}>
                  {settings[key]}%
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {hint}
              </Typography>
              <Slider
                value={settings[key]}
                onChange={(_: unknown, value: number | number[]) =>
                  setSettings((old: Settings) => ({ ...old, [key]: value }))
                }
              />
            </Box>
          ),
        )}
        <Button
          variant="contained"
          size="large"
          startIcon={<DocumentScannerRoundedIcon />}
          disabled={processing}
          onClick={process}
          sx={{ minHeight: 50 }}
        >
          {processing ? "处理中…" : "开始处理"}
        </Button>
      </Stack>
    </Card>
  );
}
function ResultView({
  photos,
  selected,
  setSelected,
  current,
  onBack,
  downloadImage,
  downloadPdf,
  reorder,
}: any) {
  return (
    <Card sx={{ p: { xs: 1.5, md: 2.5 } }}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={`${photos.length} 页`} color="success" />
            <Typography fontWeight={700}>处理完成</Typography>
          </Stack>
          <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack}>
            返回调整
          </Button>
        </Stack>
        <Paper
          sx={{
            minHeight: 520,
            display: "grid",
            placeItems: "center",
            p: 2,
            background: "#f3f4f8",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <img
            src={current?.processed}
            alt="处理结果"
            style={{
              maxWidth: "100%",
              maxHeight: 620,
              objectFit: "contain",
              display: "block",
              borderRadius: 8,
            }}
          />
        </Paper>
        <Thumbs
          photos={photos}
          selected={selected}
          setSelected={setSelected}
          reorder={reorder}
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            variant="outlined"
            startIcon={<DownloadRoundedIcon />}
            onClick={downloadImage}
            sx={{ minHeight: 48 }}
          >
            下载当前图片
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadRoundedIcon />}
            onClick={downloadPdf}
            sx={{ minHeight: 48 }}
          >
            下载 PDF（{photos.length} 页）
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}
