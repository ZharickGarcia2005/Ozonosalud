from django import forms
from django.core.exceptions import ValidationError

from .models import Publication, SiteProfile


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE = 3 * 1024 * 1024


def validate_image_upload(upload):
    if not upload:
        return
    if not hasattr(upload, "content_type"):
        return
    if upload.size > MAX_IMAGE_SIZE:
        raise ValidationError("La imagen no debe superar 3 MB.")
    if upload.content_type not in ALLOWED_IMAGE_TYPES:
        raise ValidationError("Sube una imagen JPG, PNG, WEBP o GIF.")


class SiteProfileForm(forms.ModelForm):
    class Meta:
        model = SiteProfile
        fields = [
            "title",
            "doctor_name",
            "tagline",
            "mission",
            "about",
            "phone",
            "address",
            "instagram_url",
            "facebook_url",
            "zoom_url",
            "logo",
            "watermark",
        ]
        widgets = {
            "mission": forms.Textarea(attrs={"rows": 3}),
            "about": forms.Textarea(attrs={"rows": 4}),
        }

    def clean_logo(self):
        upload = self.cleaned_data.get("logo")
        validate_image_upload(upload)
        return upload

    def clean_watermark(self):
        upload = self.cleaned_data.get("watermark")
        validate_image_upload(upload)
        return upload


class PublicationForm(forms.ModelForm):
    class Meta:
        model = Publication
        fields = ["title", "summary", "image", "image_url", "content", "published"]
        widgets = {
            "summary": forms.Textarea(attrs={"rows": 3}),
            "content": forms.Textarea(attrs={"rows": 8}),
        }

    def clean_image(self):
        upload = self.cleaned_data.get("image")
        validate_image_upload(upload)
        return upload
