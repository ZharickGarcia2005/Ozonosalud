# OZONO SALUD

Aplicacion Django para agendar citas, administrar publicaciones y gestionar un panel medico para OZONO SALUD.

## Requisitos

- Python 3.12 o superior
- pip

## Uso local

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Abre `http://127.0.0.1:8000/`.

## Variables de entorno

Copia `.env.example` como referencia y configura estos valores en produccion:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`

## PythonAnywhere

1. Clona este repositorio en PythonAnywhere.
2. Crea un virtualenv e instala `requirements.txt`.
3. Configura las variables de entorno del archivo `.env.example`.
4. Ejecuta migraciones con `python manage.py migrate`.
5. Ejecuta `python manage.py collectstatic`.
6. Configura la app web para usar `telemedicina.wsgi`.

No subas `db.sqlite3`, `.env`, `.venv`, `media/` ni `staticfiles/` a GitHub.
