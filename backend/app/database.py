from collections.abc import Generator
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.services.runtime_paths import get_storage_dir


STORAGE_DIR = get_storage_dir()
DATABASE_URL = f"sqlite:///{STORAGE_DIR / 'qingying.db'}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _run_lightweight_migrations()


def _run_lightweight_migrations() -> None:
    """Keep first-version SQLite databases usable without adding Alembic yet."""
    inspector = inspect(engine)
    with engine.begin() as connection:
        if "projects" in inspector.get_table_names():
            project_columns = {column["name"] for column in inspector.get_columns("projects")}
            project_additions = {
                "event_date": "VARCHAR(32)",
                "location": "VARCHAR(160)",
                "photographer": "VARCHAR(120)",
                "source_path": "TEXT",
            }
            for column_name, column_type in project_additions.items():
                if column_name not in project_columns:
                    connection.execute(
                        text(f"ALTER TABLE projects ADD COLUMN {column_name} {column_type}")
                    )

        table_names = set(inspector.get_table_names())
        if "images" in table_names and "photos" in table_names:
            existing_photo_count = connection.execute(text("SELECT COUNT(*) FROM photos")).scalar()
            legacy_image_count = connection.execute(text("SELECT COUNT(*) FROM images")).scalar()
            if legacy_image_count and not existing_photo_count:
                connection.execute(
                    text(
                        """
                        INSERT INTO photos (
                            id, project_id, file_name, file_path, thumbnail_path,
                            file_size, width, height, blur_score, exposure_score,
                            resolution_score, total_score, issue_tags, perceptual_hash,
                            status, created_at, updated_at
                        )
                        SELECT
                            id,
                            project_id,
                            file_name,
                            file_path,
                            thumbnail_path,
                            file_size,
                            width,
                            height,
                            blur_score,
                            CASE
                                WHEN exposure_status = 'normal' THEN 85
                                WHEN exposure_status IN ('underexposed', 'overexposed') THEN 45
                                ELSE NULL
                            END,
                            CASE
                                WHEN resolution_status = 'high' THEN 100
                                WHEN resolution_status = 'normal' THEN 80
                                WHEN resolution_status = 'low' THEN 45
                                ELSE NULL
                            END,
                            auto_score,
                            quality_flags,
                            image_hash,
                            CASE
                                WHEN manual_status IN ('accepted', 'selected') THEN 'keep'
                                WHEN manual_status = 'rejected' THEN 'reject'
                                WHEN suggest_status = 'keep' THEN 'keep'
                                WHEN suggest_status = 'reject' THEN 'reject'
                                ELSE 'pending'
                            END,
                            created_at,
                            updated_at
                        FROM images
                        """
                    )
                )
