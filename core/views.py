import json
from datetime import datetime

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.http import HttpResponseForbidden, JsonResponse
from django.core.cache import cache
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.core.validators import validate_email
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from .forms import PublicationForm, SiteProfileForm
from .models import Appointment, Patient, Publication, SiteProfile


MAX_JSON_BODY_SIZE = 16_384


def client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def rate_limited(request, scope, limit, window_seconds):
    key = f"rate:{scope}:{client_ip(request)}"
    added = cache.add(key, 1, window_seconds)
    if added:
        return False
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, window_seconds)
        return False
    return count > limit


def parse_json_body(request):
    if len(request.body) > MAX_JSON_BODY_SIZE:
        return None, JsonResponse({"error": "Solicitud demasiado grande."}, status=413)
    try:
        return json.loads(request.body.decode("utf-8")), None
    except json.JSONDecodeError:
        return None, JsonResponse({"error": "Solicitud invalida."}, status=400)


def csrf_failure(request, reason=""):
    if request.path.startswith("/api/"):
        return JsonResponse(
            {"error": "No se pudo validar la seguridad del formulario. Recarga la pagina e intenta de nuevo."},
            status=403,
        )
    return HttpResponseForbidden("No se pudo validar la seguridad del formulario.")


def get_site_profile():
    profile = SiteProfile.objects.first()
    if profile:
        return profile
    return SiteProfile.objects.create()


@ensure_csrf_cookie
def index(request):
    profile = get_site_profile()
    publications = Publication.objects.filter(published=True)[:6]
    title_parts = profile.title.split(" ", 1)
    return render(
        request,
        "index.html",
        {"profile": profile, "publications": publications, "title_parts": title_parts},
    )


def publication_detail(request, publication_id):
    publication = get_object_or_404(Publication, id=publication_id, published=True)
    profile = get_site_profile()
    return render(request, "publication_detail.html", {"publication": publication, "profile": profile})


def patient_payload(patient):
    return {
        "id": patient.id,
        "name": patient.name,
        "email": patient.email,
        "age": patient.age,
        "condition": patient.condition,
        "last": patient.last,
        "initials": patient.initials,
    }


def appointment_payload(appt):
    return {
        "id": appt.id,
        "date": appt.date.isoformat(),
        "time": appt.time,
        "patient": appt.patient.name,
        "email": appt.patient.email,
        "type": appt.type,
        "status": appt.status,
        "zoom_link": appt.get_zoom_link(),
        "code": appt.code,
        "clinical_notes": appt.clinical_notes,
        "prescription": appt.prescription,
        "exam_order": appt.exam_order,
        "certificate_patient_id": appt.certificate_patient_id,
        "certificate_reason": appt.certificate_reason,
    }


@login_required(login_url="doctor_login")
def doctor_panel(request):
    today = timezone.localdate()
    appointments = Appointment.objects.select_related("patient").all().order_by("date", "time")
    profile = get_site_profile()
    return render(
        request,
        "doctor_panel.html",
        {
            "appointments": appointments,
            "profile": profile,
            "today": today,
            "today_count": appointments.filter(date=today).count(),
            "pending_count": appointments.exclude(status="Completada").count(),
        },
    )


@login_required(login_url="doctor_login")
@require_http_methods(["POST"])
def appointment_notes_api(request, appointment_id):
    payload, error_response = parse_json_body(request)
    if error_response:
        return error_response

    try:
        appointment = Appointment.objects.select_related("patient").get(id=appointment_id)
    except Appointment.DoesNotExist:
        return JsonResponse({"error": "Cita no encontrada."}, status=404)

    appointment.clinical_notes = payload.get("clinical_notes", "").strip()
    appointment.prescription = payload.get("prescription", "").strip()
    appointment.exam_order = payload.get("exam_order", "").strip()
    appointment.certificate_patient_id = payload.get("certificate_patient_id", "").strip()[:20]
    appointment.certificate_reason = payload.get("certificate_reason", "").strip()
    appointment.status = payload.get("status", appointment.status).strip() or appointment.status
    appointment.save()
    return JsonResponse(appointment_payload(appointment))


@login_required(login_url="doctor_login")
def panel_site_settings(request):
    profile = get_site_profile()
    if request.method == "POST":
        form = SiteProfileForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            return redirect("panel_site_settings")
    else:
        form = SiteProfileForm(instance=profile)
    return render(request, "panel_site_settings.html", {"form": form, "profile": profile})


@login_required(login_url="doctor_login")
def panel_publications(request):
    publications = Publication.objects.all()
    profile = get_site_profile()
    return render(
        request,
        "panel_publications.html",
        {"publications": publications, "profile": profile},
    )


@login_required(login_url="doctor_login")
def panel_publication_create(request):
    profile = get_site_profile()
    if request.method == "POST":
        form = PublicationForm(request.POST, request.FILES)
        if form.is_valid():
            form.save()
            return redirect("panel_publications")
    else:
        form = PublicationForm()
    return render(
        request,
        "panel_publication_form.html",
        {"form": form, "profile": profile, "title": "Nueva publicacion"},
    )


@login_required(login_url="doctor_login")
def panel_publication_edit(request, publication_id):
    publication = get_object_or_404(Publication, id=publication_id)
    profile = get_site_profile()
    if request.method == "POST":
        form = PublicationForm(request.POST, request.FILES, instance=publication)
        if form.is_valid():
            form.save()
            return redirect("panel_publications")
    else:
        form = PublicationForm(instance=publication)
    return render(
        request,
        "panel_publication_form.html",
        {"form": form, "profile": profile, "title": "Editar publicacion"},
    )


def patients_api(request):
    return JsonResponse({"error": "Acceso restringido al panel administrador."}, status=403)


@require_http_methods(["GET", "POST"])
def appointments_api(request):
    if request.method == "POST":
        if rate_limited(request, "appointments:create", 8, 300):
            return JsonResponse({"error": "Demasiados intentos. Espera unos minutos."}, status=429)
        return create_appointment(request)

    appointments = [
        {
            "date": appt.date.isoformat(),
            "time": appt.time,
        }
        for appt in Appointment.objects.all().order_by("date", "time")
    ]
    return JsonResponse(appointments, safe=False)


def appointment_lookup_api(request):
    if rate_limited(request, "appointments:lookup", 20, 300):
        return JsonResponse({"error": "Demasiadas consultas. Espera unos minutos."}, status=429)

    code = request.GET.get("code", "").strip().upper()
    email = request.GET.get("email", "").strip().lower()

    if not code:
        return JsonResponse({"error": "Ingresa el codigo de revision."}, status=400)
    if len(code) > 8:
        return JsonResponse({"error": "Codigo invalido."}, status=400)
    if email:
        try:
            validate_email(email)
        except ValidationError:
            return JsonResponse({"error": "Correo invalido."}, status=400)

    try:
        appointment = Appointment.objects.select_related("patient").get(code=code)
    except Appointment.DoesNotExist:
        return JsonResponse({"error": "No encontramos una cita con ese codigo."}, status=404)

    if email and appointment.patient.email.lower() != email:
        return JsonResponse({"error": "El correo no coincide con el codigo ingresado."}, status=403)

    return JsonResponse(appointment_payload(appointment))


def create_appointment(request):
    payload, error_response = parse_json_body(request)
    if error_response:
        return error_response

    name = payload.get("name", "").strip()[:100]
    email = payload.get("email", "").strip().lower()[:254]
    age = payload.get("age")
    condition = payload.get("condition", "").strip()[:200]
    appointment_type = (payload.get("type", "").strip() or "Consulta medica")[:100]
    date_value = payload.get("date", "").strip()
    time_value = payload.get("time", "").strip()

    missing_fields = [
        label
        for label, value in [
            ("nombre", name),
            ("correo electronico", email),
            ("edad", age),
            ("motivo", condition),
            ("fecha", date_value),
            ("hora", time_value),
        ]
        if value in ("", None)
    ]
    if missing_fields:
        return JsonResponse({"error": f"Faltan datos: {', '.join(missing_fields)}."}, status=400)

    try:
        date_obj = datetime.strptime(date_value, "%Y-%m-%d").date()
        time_obj = datetime.strptime(time_value, "%H:%M").time()
        age_value = int(age)
    except ValueError:
        return JsonResponse({"error": "Revisa la fecha, hora y edad ingresadas."}, status=400)

    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({"error": "Ingresa un correo electronico valido."}, status=400)

    if not 1 <= age_value <= 120:
        return JsonResponse({"error": "La edad debe estar entre 1 y 120."}, status=400)

    if date_obj < timezone.localdate():
        return JsonResponse({"error": "La fecha no puede estar en el pasado."}, status=400)

    if time_obj.minute != 0:
        return JsonResponse({"error": "Las citas deben agendarse en horas exactas, por ejemplo 05:00, 06:00 o 07:00."}, status=400)

    normalized_time = time_obj.strftime("%H:%M")
    if Appointment.objects.filter(date=date_obj, time=normalized_time).exists():
        return JsonResponse({"error": "Ese horario ya esta ocupado. Elige otra hora del mismo dia."}, status=409)

    patient = Patient.objects.filter(email__iexact=email).first()
    if patient is None:
        patient, _ = Patient.objects.get_or_create(
            name=name,
            defaults={
                "email": email,
                "age": age_value,
                "condition": condition,
                "last": "",
            },
        )
    patient.email = email
    patient.age = age_value
    patient.condition = condition
    patient.save()

    try:
        appointment = Appointment.objects.create(
            date=date_obj,
            time=normalized_time,
            patient=patient,
            type=appointment_type,
            status="Confirmada",
        )
    except IntegrityError:
        return JsonResponse({"error": "Ese horario acaba de ser reservado. Elige otra hora."}, status=409)

    return JsonResponse(appointment_payload(appointment), status=201)
