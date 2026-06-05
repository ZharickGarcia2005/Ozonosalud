import secrets
import string

from django.db import models
from django.utils import timezone


class Patient(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="Nombre")
    email = models.EmailField(blank=True, verbose_name="Correo electronico")
    age = models.IntegerField(verbose_name="Edad")
    condition = models.CharField(max_length=200, verbose_name="Diagnostico / Condicion")
    last = models.CharField(max_length=100, blank=True, verbose_name="Ultima atencion")
    initials = models.CharField(max_length=10, blank=True, verbose_name="Iniciales")

    def save(self, *args, **kwargs):
        if self.name:
            self.initials = "".join([part[0].upper() for part in self.name.split() if part])[:2]
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Paciente"
        verbose_name_plural = "Pacientes"


class Appointment(models.Model):
    date = models.DateField(default=timezone.localdate, verbose_name="Fecha")
    time = models.CharField(max_length=10, verbose_name="Hora (ej. 09:00)")
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, verbose_name="Paciente")
    type = models.CharField(max_length=100, verbose_name="Tipo de cita")
    status = models.CharField(max_length=50, default="Confirmada", verbose_name="Estado")
    zoom_link = models.URLField(blank=True, default="", verbose_name="Enlace de Zoom")
    code = models.CharField(max_length=8, unique=True, blank=True, verbose_name="Codigo de revision")
    clinical_notes = models.TextField(blank=True, verbose_name="Notas de la consulta")
    prescription = models.TextField(blank=True, verbose_name="Recetario")
    exam_order = models.TextField(blank=True, verbose_name="Orden de examen")

    def save(self, *args, **kwargs):
        if not self.code:
            alphabet = string.ascii_uppercase + string.digits
            while True:
                code = "".join(secrets.choice(alphabet) for _ in range(6))
                if not Appointment.objects.filter(code=code).exists():
                    self.code = code
                    break
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.date} {self.time} - {self.patient.name}"

    def get_zoom_link(self):
        profile = SiteProfile.objects.first()
        return profile.zoom_url if profile else ""

    class Meta:
        verbose_name = "Cita"
        verbose_name_plural = "Citas"
        constraints = [
            models.UniqueConstraint(fields=["date", "time"], name="unique_appointment_slot")
        ]


class SiteProfile(models.Model):
    title = models.CharField(max_length=140, default="OZONO SALUD", verbose_name="Titulo")
    about = models.TextField(
        default="Consulta medica en linea con atencion cercana, organizada y segura.",
        verbose_name="Quienes somos",
    )
    mission = models.TextField(blank=True, verbose_name="Mision / mensaje principal")
    phone = models.CharField(max_length=40, blank=True, verbose_name="Telefono")
    address = models.CharField(max_length=180, blank=True, verbose_name="Direccion")
    instagram_url = models.URLField(
        default="https://www.instagram.com/ozono_salud_/",
        verbose_name="Instagram",
    )
    facebook_url = models.URLField(
        default="https://www.facebook.com/ozonosaludmantaec",
        verbose_name="Facebook",
    )
    zoom_url = models.URLField(blank=True, verbose_name="Cuenta o enlace de Zoom")

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = "Informacion del sitio"
        verbose_name_plural = "Informacion del sitio"


class Publication(models.Model):
    title = models.CharField(max_length=160, verbose_name="Titulo")
    summary = models.CharField(max_length=260, verbose_name="Resumen")
    image = models.FileField(upload_to="publications/", blank=True, verbose_name="Imagen")
    image_url = models.URLField(blank=True, verbose_name="Link de imagen")
    content = models.TextField(verbose_name="Contenido")
    published = models.BooleanField(default=True, verbose_name="Publicado")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creado")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Actualizado")

    @property
    def image_src(self):
        if self.image:
            return self.image.url
        return self.image_url

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = "Publicacion"
        verbose_name_plural = "Publicaciones"
        ordering = ["-created_at"]
