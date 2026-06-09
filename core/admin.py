from django.contrib import admin
from .models import Appointment, Patient, Publication, SiteProfile


admin.site.site_header = "OZONO SALUD administracion"
admin.site.site_title = "OZONO SALUD"
admin.site.index_title = "Panel de contenido y consultas"


def superuser_admin_access(request):
    return request.user.is_active and request.user.is_superuser


admin.site.has_permission = superuser_admin_access

@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'age', 'condition', 'last', 'initials')
    search_fields = ('name', 'email', 'condition')
    readonly_fields = ('initials',)

@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('date', 'time', 'patient', 'type', 'status', 'code')
    list_filter = ('date', 'status', 'type')
    search_fields = ('patient__name', 'patient__email', 'type', 'code')
    readonly_fields = ('code',)
    fieldsets = (
        ("Datos de la cita", {"fields": ("date", "time", "patient", "type", "status", "code")}),
        ("Consulta", {"fields": ("clinical_notes", "prescription", "exam_order")}),
    )


@admin.register(SiteProfile)
class SiteProfileAdmin(admin.ModelAdmin):
    list_display = ("title", "phone", "address", "zoom_url", "instagram_url", "facebook_url")
    fieldsets = (
        ("Presentacion publica", {"fields": ("title", "doctor_name", "tagline", "about", "mission")}),
        ("Contacto, redes y Zoom", {"fields": ("phone", "address", "zoom_url", "instagram_url", "facebook_url")}),
        ("Marca", {"fields": ("logo", "watermark")}),
    )


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    list_display = ("title", "published", "created_at", "updated_at")
    list_filter = ("published", "created_at")
    search_fields = ("title", "summary", "content", "image_url")
    list_editable = ("published",)
    fieldsets = (
        ("Contenido", {"fields": ("title", "summary", "content", "published")}),
        ("Imagen", {"fields": ("image", "image_url")}),
    )
