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
  return value
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

    window.print();
  });
});
