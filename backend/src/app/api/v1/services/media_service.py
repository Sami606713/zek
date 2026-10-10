"""Media storage on Cloudinary: validate, upload and delete images.

The Cloudinary SDK is synchronous, so calls run in a worker thread to keep the event loop free.
"""

import logging
from dataclasses import dataclass

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool

from src.app.config import settings

logger = logging.getLogger(__name__)

# Detected from the file's first bytes, never from the client-supplied name or content type.
_SIGNATURES: list[tuple[bytes, int, str]] = [
    (b"\xff\xd8\xff", 0, "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", 0, "image/png"),
    (b"GIF87a", 0, "image/gif"),
    (b"GIF89a", 0, "image/gif"),
    (b"WEBP", 8, "image/webp"),     # RIFF....WEBP
    (b"ftypavif", 4, "image/avif"),
]


@dataclass
class UploadedImage:
    url: str
    public_id: str
    width: int | None
    height: int | None
    bytes: int | None
    format: str | None


def _configure() -> None:
    if not settings.cloudinary_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
        )
    if settings.CLOUDINARY_URL:
        cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL, secure=True)
    else:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )


def detect_image_type(data: bytes) -> str | None:
    for signature, offset, mime in _SIGNATURES:
        if data[offset : offset + len(signature)] == signature:
            return mime
    return None


async def read_image(file: UploadFile) -> bytes:
    """Read an upload with a size cap and confirm it really is an image."""
    max_bytes = settings.MAX_IMAGE_UPLOAD_MB * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is empty")
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image is larger than {settings.MAX_IMAGE_UPLOAD_MB} MB",
        )
    if detect_image_type(data) is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG, PNG, WebP, AVIF or GIF images are allowed",
        )
    return data


async def upload_image(data: bytes, folder: str) -> UploadedImage:
    _configure()
    try:
        result = await run_in_threadpool(
            cloudinary.uploader.upload,
            data,
            folder=f"{settings.CLOUDINARY_FOLDER}/{folder}",
            resource_type="image",
            unique_filename=True,
            overwrite=False,
        )
    except Exception:
        logger.exception("Cloudinary upload failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Image upload failed. Please try again.")

    return UploadedImage(
        url=result["secure_url"],
        public_id=result["public_id"],
        width=result.get("width"),
        height=result.get("height"),
        bytes=result.get("bytes"),
        format=result.get("format"),
    )


async def delete_image(public_id: str) -> None:
    """Best effort: a failed delete is logged, never blocks removing the record."""
    if not settings.cloudinary_configured:
        logger.warning("Skipping Cloudinary delete for %s: storage not configured", public_id)
        return
    _configure()
    try:
        await run_in_threadpool(cloudinary.uploader.destroy, public_id, resource_type="image", invalidate=True)
    except Exception:
        logger.exception("Cloudinary delete failed for %s", public_id)
