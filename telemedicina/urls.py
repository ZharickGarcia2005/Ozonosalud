from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path
from core import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.index, name='index'),
    path('publicaciones/<int:publication_id>/', views.publication_detail, name='publication_detail'),
    path('panel/', views.doctor_panel, name='doctor_panel'),
    path('api/patients', views.patients_api, name='patients_api'),
    path('api/appointments', views.appointments_api, name='appointments_api'),
    path('api/appointments/lookup', views.appointment_lookup_api, name='appointment_lookup_api'),
    path('api/appointments/<int:appointment_id>/notes', views.appointment_notes_api, name='appointment_notes_api'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
