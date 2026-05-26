from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    event_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    event_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    location: Mapped[str | None] = mapped_column(String(160), nullable=True)
    photographer: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    photos: Mapped[list["Photo"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    similar_groups: Mapped[list["SimilarGroup"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        foreign_keys="SimilarGroup.project_id",
    )
    exports: Mapped[list["ExportRecord"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    thumbnail_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_format: Mapped[str | None] = mapped_column(String(32), nullable=True)
    exif_datetime: Mapped[str | None] = mapped_column(String(64), nullable=True)

    blur_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    exposure_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    resolution_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    composition_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    issue_tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    perceptual_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    ai_category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    user_category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    recommended_usage: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project: Mapped[Project] = relationship(back_populates="photos")
    similarities: Mapped[list["PhotoSimilarity"]] = relationship(
        back_populates="photo",
        cascade="all, delete-orphan",
    )
    ai_analyses: Mapped[list["AIAnalysis"]] = relationship(
        back_populates="photo",
        cascade="all, delete-orphan",
    )


# Backward-compatible import name for first-version routers/components.
Image = Photo


class SimilarGroup(Base):
    __tablename__ = "similar_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    recommended_photo_id: Mapped[int | None] = mapped_column(
        ForeignKey("photos.id"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped[Project] = relationship(
        back_populates="similar_groups",
        foreign_keys=[project_id],
    )
    recommended_photo: Mapped[Photo | None] = relationship(
        foreign_keys=[recommended_photo_id],
    )
    photos: Mapped[list["PhotoSimilarity"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
    )


class PhotoSimilarity(Base):
    __tablename__ = "photo_similarity"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("similar_groups.id"), index=True)
    photo_id: Mapped[int] = mapped_column(ForeignKey("photos.id"), index=True)
    similarity_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    group: Mapped[SimilarGroup] = relationship(back_populates="photos")
    photo: Mapped[Photo] = relationship(back_populates="similarities")


class AIAnalysis(Base):
    __tablename__ = "ai_analysis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    photo_id: Mapped[int] = mapped_column(ForeignKey("photos.id"), index=True)
    provider: Mapped[str] = mapped_column(String(80), nullable=False)
    scene_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommended_usage: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    raw_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    photo: Mapped[Photo] = relationship(back_populates="ai_analyses")


class ExportRecord(Base):
    __tablename__ = "exports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    export_path: Mapped[str] = mapped_column(Text, nullable=False)
    export_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    keep_count: Mapped[int] = mapped_column(Integer, default=0)
    candidate_count: Mapped[int] = mapped_column(Integer, default=0)
    reject_count: Mapped[int] = mapped_column(Integer, default=0)
    report_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped[Project] = relationship(back_populates="exports")


class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
