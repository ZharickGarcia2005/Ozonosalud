function getCookie(name) {
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

document.querySelector("#staffSearch")?.addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll(".consultation-card").forEach((card) => {
    card.hidden = !card.dataset.search.toLowerCase().includes(query);
  });
});

document.querySelectorAll(".notes-form").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = form.querySelector(".form-message");
    const appointmentId = form.dataset.appointmentId;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    message.textContent = "Guardando...";
    message.className = "form-message";

    try {
      const response = await fetch(`/api/appointments/${appointmentId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo guardar.");
      }

      const card = form.closest(".consultation-card");
      card.querySelector(".appointment-status").textContent = result.status;
      card.dataset.search = `${card.dataset.search} ${result.status}`;
      message.classList.add("success");
      message.textContent = "Notas guardadas.";
    } catch (error) {
      message.classList.add("error");
      message.textContent = error.message;
    }
  });
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDocumentText(value) {
  const cleanValue = value.trim();
  if (!cleanValue) return "<p class=\"print-empty\">Sin indicaciones registradas.</p>";

  return cleanValue
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function waitForPrintImages(container) {
  const images = Array.from(container.querySelectorAll("img"));
  return Promise.all(
    images.map((image) => {
      if (image.complete) {
        if (image.naturalWidth > 0 && image.decode) {
          return image.decode().catch(() => undefined);
        }
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    })
  );
}

function setCertificatePageStyle(enabled) {
  const styleId = "certificatePrintPageStyle";
  const existingStyle = document.querySelector(`#${styleId}`);

  if (!enabled) {
    existingStyle?.remove();
    return;
  }

  if (existingStyle) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = "@page { size: A4 portrait; margin: 0; }";
  document.head.appendChild(style);
}

function preparePrintMode(isCertificate) {
  document.body.classList.toggle("certificate-print-mode", isCertificate);
  setCertificatePageStyle(isCertificate);
}

function clearPrintMode() {
  document.body.classList.remove("certificate-print-mode");
  setCertificatePageStyle(false);
}

window.addEventListener("afterprint", clearPrintMode);

function renderStandardDocument(button, form, printArea) {
  const documentType = button.dataset.documentType;
  const siteTitle = document.body.dataset.siteTitle || "OZONO SALUD";
  const siteTagline = document.body.dataset.siteTagline || "Tu salud en buenas manos";
  const doctorName = document.body.dataset.doctorName || "";
  const logoSrc = document.body.dataset.logoSrc || "/static/receipt-logo.png";
  const watermarkSrc = document.body.dataset.watermarkSrc || logoSrc;
  const sourceField = form.querySelector(`[name="${documentType}"]`);
  const title = documentType === "prescription" ? "Recetario medico" : "Orden de examen";
  const documentClass = documentType === "exam_order" ? "exam-print-sheet" : "prescription-print-sheet";

  printArea.innerHTML = `
    <article class="medical-print-sheet ${documentClass}">
      <img class="print-watermark" src="${escapeHtml(watermarkSrc)}" alt="" />
      <header class="print-header">
        <img class="print-logo" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(siteTitle)}" />
        <div>
          <p class="eyebrow">${escapeHtml(siteTitle)}</p>
          <h1>${title}</h1>
          <p class="print-tagline">${escapeHtml(siteTagline)}</p>
          ${doctorName ? `<p class="appointment-meta">${escapeHtml(doctorName)}</p>` : ""}
        </div>
        <div class="print-code">Codigo ${escapeHtml(button.dataset.code)}</div>
      </header>

      <section class="print-patient-grid">
        <p><strong>Paciente:</strong> ${escapeHtml(button.dataset.patient)}</p>
        <p><strong>Edad:</strong> ${escapeHtml(button.dataset.age)} años</p>
        <p><strong>Fecha:</strong> ${escapeHtml(button.dataset.date)}</p>
      </section>

      <section class="print-body">
        ${formatDocumentText(sourceField.value)}
      </section>

      <footer class="print-footer">
        <div class="signature-line"></div>
        <p>Firma y sello medico</p>
      </footer>
    </article>
  `;
}

function getCertificateData(button, form) {
  const appointmentDate = button.dataset.attentionDate || button.dataset.date || "";

  return {
    patient: button.dataset.patient,
    age: button.dataset.age,
    attentionDate: appointmentDate,
    issuedDate: button.dataset.issuedDate || appointmentDate,
    time: button.dataset.time,
    code: button.dataset.code,
    patientId: form.querySelector('[name="certificate_patient_id"]')?.value.trim() || "",
    reason: form.querySelector('[name="certificate_reason"]')?.value.trim() || "",
  };
}

function formatCertificateText(data) {
  return `
    <p>
      El Consultorio M&eacute;dico <strong>OZONO SALUD</strong> certifica que el/la paciente
      <strong>${escapeHtml(data.patient)}</strong>, de <strong>${escapeHtml(data.age)} a&ntilde;os de edad</strong>,
      con c&eacute;dula de identidad N.&deg; <strong>${escapeHtml(data.patientId)}</strong>, fue atendido/a
      en consulta m&eacute;dica por el Dr. <strong>Fabricio Ch&aacute;vez</strong> el d&iacute;a
      <strong>${escapeHtml(data.attentionDate)}</strong>, a las <strong>${escapeHtml(data.time)}</strong>,
      en la ciudad de <strong>Manta, Manab&iacute;</strong>, presentando un cuadro cl&iacute;nico compatible
      con <strong>${escapeHtml(data.reason)}</strong>.
    </p>

    <p>
      El presente certificado se emite a solicitud del/de la interesado/a, para los fines pertinentes.
    </p>

    <div class="certificate-details">
      <p><strong>Fecha de atenci&oacute;n:</strong> <strong>${escapeHtml(data.attentionDate)}</strong></p>
      <p><strong>Lugar y fecha:</strong> Manta, Manab&iacute;, <strong>${escapeHtml(data.issuedDate)}</strong></p>
      <p><strong>Hora de atenci&oacute;n:</strong> <strong>${escapeHtml(data.time)}</strong></p>
      <p><strong>C&oacute;digo de certificado:</strong> <strong>${escapeHtml(data.code)}</strong></p>
    </div>

    <div class="certificate-signature-block">
      <p>
        <strong>Dr. Fabricio Ch&aacute;vez</strong><br>
        M&eacute;dico tratante<br>
        Consultorio M&eacute;dico <strong>OZONO SALUD</strong>
      </p>
      <p><strong>Sello:</strong> <span class="certificate-seal-line"></span></p>
    </div>
  `;
}

function renderCertificateDocument(button, form, printArea) {
  const message = form.querySelector(".form-message");
  const siteTitle = document.body.dataset.siteTitle || "OZONO SALUD";
  const siteTagline = document.body.dataset.siteTagline || "Tu salud en buenas manos";
  const logoSrc = document.body.dataset.logoSrc || "/static/receipt-logo.png";
  const watermarkSrc = document.body.dataset.watermarkSrc || logoSrc;
  const data = getCertificateData(button, form);

  if (!data.patientId || !data.reason) {
    message.className = "form-message error";
    message.textContent = "Completa la cedula y la razon del certificado.";
    return false;
  }

  printArea.innerHTML = `
    <article class="medical-print-sheet certificate-print-sheet">
      <div class="certificate-frame certificate-frame-outer" aria-hidden="true"></div>
      <div class="certificate-frame certificate-frame-inner" aria-hidden="true"></div>
      <img class="certificate-watermark" src="${escapeHtml(watermarkSrc)}" alt="" />
      <header class="print-header">
        <img class="print-logo" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(siteTitle)}" />
        <div>
          <p class="eyebrow">${escapeHtml(siteTitle)}</p>
          <h1>Certificado m&eacute;dico</h1>
          <p class="print-tagline">${escapeHtml(siteTagline)}</p>
          <p class="appointment-meta">Dr. Fabricio Ch&aacute;vez</p>
        </div>
      </header>

      <section class="print-body certificate-body">
        ${formatCertificateText(data)}
      </section>
    </article>
  `;

  return true;
}

document.querySelectorAll(".print-document").forEach((button) => {
  button.addEventListener("click", async () => {
    const form = button.closest(".notes-form");
    const printArea = document.querySelector("#printArea");
    const documentType = button.dataset.documentType;

    if (documentType === "medical_certificate") {
      if (!renderCertificateDocument(button, form, printArea)) return;
      preparePrintMode(true);
    } else {
      renderStandardDocument(button, form, printArea);
      preparePrintMode(false);
    }

    await waitForPrintImages(printArea);
    window.print();
  });
});
