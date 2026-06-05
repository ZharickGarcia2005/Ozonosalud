let reservedSlots = [];

const appointmentForm = document.querySelector("#appointmentForm");
const lookupForm = document.querySelector("#lookupForm");
const appointmentMessage = document.querySelector("#appointmentMessage");
const lookupResult = document.querySelector("#lookupResult");
const appointmentTime = document.querySelector("#appointmentTime");
const todayIso = new Date().toISOString().slice(0, 10);

function setDefaultDate() {
  const dateInput = appointmentForm?.elements.date;
  if (dateInput) {
    dateInput.min = todayIso;
    dateInput.value = dateInput.value || todayIso;
  }
}

function buildTimeOptions() {
  if (!appointmentTime) return;

  appointmentTime.innerHTML = "";
  for (let hour = 5; hour <= 20; hour += 1) {
    const value = `${String(hour).padStart(2, "0")}:00`;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    appointmentTime.appendChild(option);
  }
  updateTimeAvailability();
}

async function loadReservedSlots() {
  try {
    const response = await fetch("/api/appointments");
    reservedSlots = await response.json();
    updateTimeAvailability();
  } catch (error) {
    console.error("Error al cargar horarios ocupados:", error);
  }
}

function updateTimeAvailability() {
  if (!appointmentTime || !appointmentForm) return;

  const dateValue = appointmentForm.elements.date.value;
  const reserved = new Set(
    reservedSlots
      .filter((item) => item.date === dateValue)
      .map((item) => item.time)
  );

  [...appointmentTime.options].forEach((option) => {
    const isReserved = reserved.has(option.value);
    option.disabled = isReserved;
    option.textContent = isReserved ? `${option.value} - ocupado` : option.value;
  });

  const available = [...appointmentTime.options].find((option) => !option.disabled);
  if (!appointmentTime.value || appointmentTime.selectedOptions[0]?.disabled) {
    appointmentTime.value = available ? available.value : "";
  }
}

function formatDate(dateValue) {
  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripPdfText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function escapePdfText(value) {
  return stripPdfText(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function createReceiptImage(width, height, opacity = 1) {
  const response = await fetch("/static/receipt-logo.png", { cache: "reload" });
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  const scale = Math.min(width / bitmap.width, height / bitmap.height) * 0.92;
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;

  context.globalAlpha = opacity;
  context.drawImage(bitmap, x, y, drawWidth, drawHeight);

  return {
    bytes: dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.92)),
    width,
    height,
  };
}

function pdfText(text, x, y, size = 12, color = "0.063 0.122 0.192") {
  return `BT ${color} rg /F1 ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;
}

function pdfLine(label, value, x, y) {
  return [
    pdfText(label, x, y, 11, "0.047 0.282 0.612"),
    pdfText(value, x, y - 18, 13),
  ].join("\n");
}

function pdfObject(number, chunks) {
  const encoder = new TextEncoder();
  const parts = [encoder.encode(`${number} 0 obj\n`)];
  chunks.forEach((chunk) => {
    parts.push(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
  });
  parts.push(encoder.encode("\nendobj\n"));
  return concatBytes(parts);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function imageObject(number, image) {
  const encoder = new TextEncoder();
  return pdfObject(number, [
    `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
    image.bytes,
    encoder.encode("\nendstream"),
  ]);
}

async function downloadReceipt(appointment) {
  const logo = await createReceiptImage(120, 150, 1);
  const watermark = await createReceiptImage(290, 390, 0.12);
  const zoomText = appointment.zoom_link || "Pendiente de configurar";
  const content = [
    "q 1 1 1 rg 0 0 612 792 re f Q",
    "q 290 0 0 390 161 190 cm /Watermark Do Q",
    "q 0.047 0.282 0.612 RG 2 w 30 30 552 732 re S Q",
    "q 0.478 0.757 0.263 RG 1 w 42 42 528 708 re S Q",
    "q 120 0 0 150 50 596 cm /Logo Do Q",
    pdfText("COMPROBANTE DE CITA", 205, 710, 20, "0.047 0.282 0.612"),
    pdfText("OZONO SALUD", 205, 684, 15, "0.478 0.757 0.263"),
    pdfText("Tu salud en buenas manos", 205, 664, 11, "0.314 0.541 0.749"),
    "q 0.047 0.282 0.612 rg 50 610 512 2 re f Q",
    pdfText(`Codigo de revision: ${appointment.code}`, 50, 575, 16, "0.047 0.282 0.612"),
    pdfText(`Estado: ${appointment.status}`, 390, 575, 12, "0.314 0.541 0.749"),
    pdfLine("Paciente", appointment.patient, 50, 530),
    pdfLine("Correo electronico", appointment.email, 320, 530),
    pdfLine("Fecha", formatDate(appointment.date), 50, 468),
    pdfLine("Hora", appointment.time, 190, 468),
    pdfLine("Tipo de cita", appointment.type, 320, 468),
    "q 0.949 0.976 1 rg 50 338 512 88 re f Q",
    "q 0.812 0.859 0.902 RG 1 w 50 338 512 88 re S Q",
    pdfText("Enlace de Zoom", 68, 392, 12, "0.047 0.282 0.612"),
    pdfText(zoomText, 68, 367, 11),
    pdfText("Presenta este comprobante o conserva tu codigo para revisar la cita en el sitio web.", 50, 285, 11, "0.314 0.424 0.510"),
    pdfText("Gracias por confiar en OZONO SALUD.", 50, 260, 12, "0.047 0.282 0.612"),
    "q 0.478 0.757 0.263 rg 50 235 512 3 re f Q",
  ].join("\n");
  const contentBytes = new TextEncoder().encode(`${content}\n`);

  const objects = [
    pdfObject(1, ["<< /Type /Catalog /Pages 2 0 R >>"]),
    pdfObject(2, ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]),
    pdfObject(3, ["<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> /XObject << /Logo 6 0 R /Watermark 7 0 R >> >> /Contents 5 0 R >>"]),
    pdfObject(4, ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]),
    pdfObject(5, [`<< /Length ${contentBytes.length} >>\nstream\n`, contentBytes, "\nendstream"]),
    imageObject(6, logo),
    imageObject(7, watermark),
  ];

  const encoder = new TextEncoder();
  const chunks = [encoder.encode("%PDF-1.4\n")];
  const offsets = [];
  let byteLength = chunks[0].length;
  objects.forEach((object) => {
    offsets.push(byteLength);
    chunks.push(object);
    byteLength += object.length;
  });
  const xrefStart = byteLength;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  chunks.push(encoder.encode(xref));

  const blob = new Blob(chunks, { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `comprobante-cita-${appointment.code}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderAppointmentActions(appointment) {
  const zoomButton = appointment.zoom_link
    ? `<a href="${escapeHtml(appointment.zoom_link)}" target="_blank" rel="noreferrer" class="primary-action zoom-btn">Ingresar a Zoom</a>`
    : `<span class="ghost-action disabled-action" aria-disabled="true">Zoom no configurado</span>`;

  return `
    <div class="appointment-confirmation-actions">
      <button class="ghost-action download-receipt" type="button">Descargar comprobante PDF</button>
      ${zoomButton}
    </div>
  `;
}

function renderAppointmentConfirmation(appointment) {
  appointmentMessage.className = "appointment-confirmation";
  appointmentMessage.innerHTML = `
    <span class="status-pill">${escapeHtml(appointment.status)}</span>
    <h3>Cita registrada</h3>
    <p>Tu codigo para revisar la cita es <strong>${escapeHtml(appointment.code)}</strong>.</p>
    <div class="receipt-summary">
      <p><strong>Paciente:</strong> ${escapeHtml(appointment.patient)}</p>
      <p><strong>Correo:</strong> ${escapeHtml(appointment.email)}</p>
      <p><strong>Fecha:</strong> ${escapeHtml(formatDate(appointment.date))}</p>
      <p><strong>Hora:</strong> ${escapeHtml(appointment.time)}</p>
      <p><strong>Tipo:</strong> ${escapeHtml(appointment.type)}</p>
      ${appointment.zoom_link ? `<p><strong>Zoom:</strong> ${escapeHtml(appointment.zoom_link)}</p>` : ""}
    </div>
    ${renderAppointmentActions(appointment)}
  `;

  appointmentMessage.querySelector(".download-receipt")?.addEventListener("click", async () => {
    await downloadReceipt(appointment);
  });
}

function renderLookup(appointment) {
  lookupResult.hidden = false;

  lookupResult.innerHTML = `
    <span class="status-pill">${escapeHtml(appointment.status)}</span>
    <h3>${escapeHtml(appointment.patient)}</h3>
    <p><strong>Fecha:</strong> ${escapeHtml(formatDate(appointment.date))}</p>
    <p><strong>Hora:</strong> ${escapeHtml(appointment.time)}</p>
    <p><strong>Tipo:</strong> ${escapeHtml(appointment.type)}</p>
    <p><strong>Codigo:</strong> ${escapeHtml(appointment.code)}</p>
    ${appointment.zoom_link ? `<p><strong>Zoom:</strong> <a href="${escapeHtml(appointment.zoom_link)}" target="_blank" rel="noreferrer">${escapeHtml(appointment.zoom_link)}</a></p>` : `<p><strong>Zoom:</strong> Pendiente de configurar</p>`}
    ${renderAppointmentActions(appointment)}
  `;

  lookupResult.querySelector(".download-receipt")?.addEventListener("click", async () => {
    await downloadReceipt(appointment);
  });
}

appointmentForm?.elements.date.addEventListener("change", updateTimeAvailability);

appointmentForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  appointmentMessage.textContent = "Creando cita...";
  appointmentMessage.className = "form-message";

  const formData = new FormData(appointmentForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "No se pudo crear la cita.");
    }

    renderAppointmentConfirmation(result);
    appointmentForm.reset();
    setDefaultDate();
    await loadReservedSlots();
  } catch (error) {
    appointmentMessage.classList.add("error");
    appointmentMessage.textContent = error.message;
  }
});

lookupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(lookupForm);
  const params = new URLSearchParams(formData);

  lookupResult.hidden = false;
  lookupResult.innerHTML = `<p class="appointment-meta">Buscando cita...</p>`;

  try {
    const response = await fetch(`/api/appointments/lookup?${params.toString()}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "No se pudo consultar la cita.");
    }

    renderLookup(result);
  } catch (error) {
    lookupResult.innerHTML = `<p class="form-message error">${error.message}</p>`;
  }
});

setDefaultDate();
buildTimeOptions();
loadReservedSlots();
