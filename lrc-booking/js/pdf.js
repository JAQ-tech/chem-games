import { APP_NAME, CREDIT_LINE, SPECIALIST_SIGN_NAME } from "./config.js";
import { addDays, cellModel, slotHoliday, weekTitle, weekdayIndex } from "./engine.js";

const DAY_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function buildWeekModel({ sunday, bookings, holidays, periods, schoolName }) {
  const days = [0, 1, 2, 3, 4].map((offset) => addDays(sunday, offset));
  const approved = (bookings || []).filter((row) => row.status === "approved");
  return {
    appName: APP_NAME,
    schoolName: schoolName || "",
    title: weekTitle(sunday),
    filename: `manhal-week-${sunday}.pdf`,
    credit: CREDIT_LINE,
    specialist: SPECIALIST_SIGN_NAME,
    columns: (periods || []).map((period) => period.label_ar),
    rows: days.map((day) => ({
      day,
      label: DAY_AR[weekdayIndex(day)],
      cells: (periods || []).map((period) => cellModel(
        approved.find((row) => row.day === day && Number(row.period) === Number(period.n)) || null,
        slotHoliday(holidays || [], day, period.n),
      )),
    })),
  };
}

let fontReady = null;

function ensureFont() {
  if (fontReady) return fontReady;
  fontReady = (async () => {
    const regular = new FontFace("Noto Naskh Arabic", "url(assets/fonts/NotoNaskhArabic-Regular.ttf)", { weight: "400" });
    const bold = new FontFace("Noto Naskh Arabic", "url(assets/fonts/NotoNaskhArabic-Bold.ttf)", { weight: "700" });
    const [a, b] = await Promise.all([regular.load(), bold.load()]);
    document.fonts.add(a);
    document.fonts.add(b);
  })();
  return fontReady;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(src));
    image.src = src;
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderWeekCanvas(model) {
  await ensureFont();
  const logos = await Promise.all([
    loadImage("assets/oman-vision-2040.png"),
    loadImage("assets/moe-logo.jpg"),
    loadImage("assets/school-logo.jpg"),
  ]);
  const width = 1684;
  const height = 1191;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.direction = "rtl";

  logos.forEach((image, index) => {
    const x = 70 + index * 150;
    ctx.drawImage(image, x, 28, 120, 78);
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#0f5132";
  ctx.font = "700 34px 'Noto Naskh Arabic'";
  ctx.fillText(model.appName, width / 2 + 80, 48);
  ctx.fillStyle = "#1e293b";
  ctx.font = "700 26px 'Noto Naskh Arabic'";
  ctx.fillText(model.schoolName, width / 2 + 80, 88);
  ctx.font = "700 22px 'Noto Naskh Arabic'";
  ctx.fillText(model.title, width / 2, 132);

  const tableX = 28;
  const tableY = 160;
  const tableW = width - 56;
  const dayW = 120;
  const colW = (tableW - dayW) / 7;
  const headerH = 42;
  const bodyH = 148;
  const columns = model.columns;

  function cellRect(col, row) {
    const x = tableX + tableW - dayW - (col + 1) * colW;
    const y = tableY + headerH + row * bodyH;
    return { x, y, w: colW, h: row === -1 ? headerH : bodyH };
  }

  ctx.fillStyle = "#0f5132";
  ctx.fillRect(tableX, tableY, tableW, headerH);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.font = "700 16px 'Noto Naskh Arabic'";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  const dayHeader = { x: tableX + tableW - dayW, y: tableY, w: dayW, h: headerH };
  ctx.strokeRect(dayHeader.x, dayHeader.y, dayHeader.w, dayHeader.h);
  ctx.fillText("اليوم", dayHeader.x + dayW / 2, dayHeader.y + headerH / 2);
  columns.forEach((label, index) => {
    const rect = cellRect(index, -1);
    ctx.fillStyle = "#0f5132";
    ctx.fillRect(rect.x, tableY, rect.w, headerH);
    ctx.strokeRect(rect.x, tableY, rect.w, headerH);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, rect.x + rect.w / 2, tableY + headerH / 2);
  });

  model.rows.forEach((row, rowIndex) => {
    const y = tableY + headerH + rowIndex * bodyH;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(dayHeader.x, y, dayW, bodyH);
    ctx.strokeRect(dayHeader.x, y, dayW, bodyH);
    ctx.fillStyle = "#0f5132";
    ctx.font = "700 18px 'Noto Naskh Arabic'";
    ctx.textAlign = "center";
    ctx.fillText(row.label, dayHeader.x + dayW / 2, y + bodyH / 2);
    row.cells.forEach((cell, colIndex) => {
      const rect = cellRect(colIndex, rowIndex);
      ctx.fillStyle = cell.kind === "holiday" ? "#e2e8f0" : cell.kind === "event" ? "#eff6ff" : cell.kind === "lesson" ? "#ecfdf5" : "#ffffff";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = "#1e293b";
      ctx.font = "400 13px 'Noto Naskh Arabic'";
      ctx.textAlign = "right";
      const lines = cell.lines.flatMap((line) => wrapText(ctx, line, rect.w - 16));
      lines.slice(0, 8).forEach((line, lineIndex) => {
        ctx.fillText(line, rect.x + rect.w - 8, rect.y + 18 + lineIndex * 16);
      });
    });
  });

  let foot = tableY + headerH + bodyH * 5 + 28;
  ctx.textAlign = "right";
  ctx.fillStyle = "#0f5132";
  ctx.font = "700 16px 'Noto Naskh Arabic'";
  ctx.fillText("ملاحظات:", width - 36, foot);
  ctx.strokeStyle = "#cbd5e1";
  for (let i = 0; i < 3; i += 1) {
    foot += 22;
    ctx.beginPath();
    ctx.moveTo(36, foot);
    ctx.lineTo(width - 36, foot);
    ctx.stroke();
  }
  foot += 28;
  ctx.fillStyle = "#1e293b";
  ctx.font = "700 15px 'Noto Naskh Arabic'";
  ctx.fillText(`أخصائي مصادر التعلم: ${model.specialist}`, width - 36, foot);
  foot += 24;
  ctx.font = "400 13px 'Noto Naskh Arabic'";
  ctx.fillText(model.credit, width - 36, foot);
  return canvas;
}

export async function downloadWeekPdf(model) {
  const canvas = await renderWeekCanvas(model);
  const { jsPDF } = await import("./vendor/jspdf.js");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageWidth, pageHeight);
  if (globalThis.ManhalAndroid?.savePdf) {
    const uri = pdf.output("datauristring");
    globalThis.ManhalAndroid.savePdf(model.filename, uri.split(",")[1]);
    return;
  }
  pdf.save(model.filename);
}
