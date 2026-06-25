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

function getDocumentTitle(documentType) {
  if (documentType === "prescription") return "Recetario medico";
  if (documentType === "exam_order") return "Orden de examen";
  return "Certificado m&eacute;dico";
}

function getDocumentClass(documentType) {
  if (documentType === "exam_order") return "exam-print-sheet";
  if (documentType === "medical_certificate") return "certificate-print-sheet";
  return "prescription-print-sheet";
}

function formatCertificateText(button) {
  const patient = escapeHtml(button.dataset.patient);
  const date = escapeHtml(button.dataset.date);
  const time = escapeHtml(button.dataset.time);

  return `
    <p>
      El consultorio m&eacute;dico <strong>OXONOSALUD</strong> certifica que el/la paciente
      <strong>${patient}</strong>, con c&eacute;dula de identidad N.&deg;
      <span class="certificate-blank certificate-blank-short"></span>, fue atendido/a en consulta
      m&eacute;dica por el Dr. <strong>Fabricio Ch&aacute;vez</strong> el d&iacute;a
      <strong>${date}</strong> a las <strong>${time}</strong>, presentando un cuadro cl&iacute;nico
      compatible con <span class="certificate-blank certificate-blank-long"></span>.
    </p>

    <p><strong>Lugar y fecha:</strong> Manta, Manab&iacute;, ${date} - ${time}</p>

    <div class="certificate-signature-block">
      <p>
        <strong>Dr. Fabricio Ch&aacute;vez</strong><br>
        M&eacute;dico tratante<br>
        Consultorio M&eacute;dico <strong>OXONOSALUD</strong>
      </p>
      <p><strong>Sello:</strong> <span class="certificate-blank certificate-blank-medium"></span></p>
    </div>
  `;
}

document.querySelectorAll(".print-document").forEach((button) => {
  button.addEventListener("click", () => {
    const form = button.closest(".notes-form");
    const printArea = document.querySelector("#printArea");
    const documentType = button.dataset.documentType;
    const siteTitle = document.body.dataset.siteTitle || "OZONO SALUD";
    const siteTagline = document.body.dataset.siteTagline || "Tu salud en buenas manos";
    const doctorName = document.body.dataset.doctorName || "";
    const logoSrc = document.body.dataset.logoSrc || "/static/receipt-logo.png";
    const watermarkSrc = document.body.dataset.watermarkSrc || logoSrc;
    const sourceField = form.querySelector(`[name="${documentType}"]`);
    const title = getDocumentTitle(documentType);
    const documentClass = getDocumentClass(documentType);
    const isCertificate = documentType === "medical_certificate";
    const bodyContent = isCertificate ? formatCertificateText(button) : formatDocumentText(sourceField?.value || "");
    const doctorLine = isCertificate
      ? "<p class=\"appointment-meta\">Dr. Fabricio Ch&aacute;vez</p>"
      : doctorName ? `<p class="appointment-meta">${escapeHtml(doctorName)}</p>` : "";
    const footer = isCertificate ? "" : `
        <footer class="print-footer">
          <div class="signature-line"></div>
          <p>Firma y sello medico</p>
        </footer>
      `;

    printArea.innerHTML = `
      <article class="medical-print-sheet ${documentClass}">
        <img class="print-watermark" src="${escapeHtml(watermarkSrc)}" alt="" />
        <header class="print-header">
          <img class="print-logo" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(siteTitle)}" />
          <div>
            <p class="eyebrow">${escapeHtml(siteTitle)}</p>
            <h1>${title}</h1>
            <p class="print-tagline">${escapeHtml(siteTagline)}</p>
            ${doctorLine}
          </div>
          <div class="print-code">Codigo ${escapeHtml(button.dataset.code)}</div>
        </header>

        <section class="print-patient-grid">
          <p><strong>Paciente:</strong> ${escapeHtml(button.dataset.patient)}</p>
          <p><strong>Edad:</strong> ${escapeHtml(button.dataset.age)} años</p>
          <p><strong>Fecha:</strong> ${escapeHtml(button.dataset.date)}</p>
          ${isCertificate ? `<p><strong>Hora:</strong> ${escapeHtml(button.dataset.time)}</p>` : ""}
        </section>

        <section class="print-body ${isCertificate ? "certificate-body" : ""}">
          ${bodyContent}
        </section>

        ${footer}
      </article>
    `;

    window.print();
  });
});
