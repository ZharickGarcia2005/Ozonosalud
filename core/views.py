import json
from datetime import datetime

from django.db import IntegrityError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.contrib.admin.views.decorators import staff_member_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Appointment, Patient, Publication, SiteProfile


def get_site_profile():
    profile = SiteProfile.objects.first()
    if profile:
        return profile
    return SiteProfile.objects.create()


def index(request):
    profile = get_site_profile()
    publications = Publication.objects.filter(published=True)[:6]
    return render(request, "index.html", {"profile": profile, "publications": publications})


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
    }


@staff_member_required
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


@staff_member_required
@require_http_methods(["POST"])
def appointment_notes_api(request, appointment_id):
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Solicitud invalida."}, status=400)

    try:
        appointment = Appointment.objects.select_related("patient").get(id=appointment_id)
    except Appointment.DoesNotExist:
        return JsonResponse({"error": "Cita no encontrada."}, status=404)

    appointment.clinical_notes = payload.get("clinical_notes", "").strip()
    appointment.prescription = payload.get("prescription", "").strip()
    appointment.exam_order = payload.get("exam_order", "").strip()
    appointment.status = payload.get("status", appointment.status).strip() or appointment.status
    appointment.save()
    return JsonResponse(appointment_payload(appointment))


def patients_api(request):
    return JsonResponse({"error": "Acceso restringido al panel administrador."}, status=403)


@require_http_methods(["GET", "POST"])
@csrf_exempt
def appointments_api(request):
    if request.method == "POST":
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
    code = request.GET.get("code", "").strip().upper()
    email = request.GET.get("email", "").strip().lower()

    if not code:
        return JsonResponse({"error": "Ingresa el codigo de revision."}, status=400)

    try:
        appointment = Appointment.objects.select_related("patient").get(code=code)
    except Appointment.DoesNotExist:
        return JsonResponse({"error": "No encontramos una cita con ese codigo."}, status=404)

    if email and appointment.patient.email.lower() != email:
        return JsonResponse({"error": "El correo no coincide con el codigo ingresado."}, status=403)

    return JsonResponse(appointment_payload(appointment))


def create_appointment(request):
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Solicitud invalida."}, status=400)

    name = payload.get("name", "").strip()
    email = payload.get("email", "").strip().lower()
    age = payload.get("age")
    condition = payload.get("condition", "").strip()
    appointment_type = payload.get("type", "").strip() or "Consulta medica"
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
