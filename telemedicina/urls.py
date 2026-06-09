from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth import views as auth_views
from django.urls import path
from core import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.index, name='index'),
    path('publicaciones/<int:publication_id>/', views.publication_detail, name='publication_detail'),
    path(
        'panel/login/',
        auth_views.LoginView.as_view(template_name='doctor_login.html', redirect_authenticated_user=True),
        name='doctor_login',
    ),
    path('panel/logout/', auth_views.LogoutView.as_view(next_page='doctor_login'), name='doctor_logout'),
    path('panel/', views.doctor_panel, name='doctor_panel'),
    path('panel/configuracion/', views.panel_site_settings, name='panel_site_settings'),
    path('panel/publicaciones/', views.panel_publications, name='panel_publications'),
    path('panel/publicaciones/nueva/', views.panel_publication_create, name='panel_publication_create'),
    path('panel/publicaciones/<int:publication_id>/editar/', views.panel_publication_edit, name='panel_publication_edit'),
    path('api/patients', views.patients_api, name='patients_api'),
    path('api/appointments', views.appointments_api, name='appointments_api'),
    path('api/appointments/lookup', views.appointment_lookup_api, name='appointment_lookup_api'),
    path('api/appointments/<int:appointment_id>/notes', views.appointment_notes_api, name='appointment_notes_api'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
