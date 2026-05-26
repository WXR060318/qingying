from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "resources" / "icons"


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    images = [create_icon(size) for size in sizes]
    images[-1].save(ICON_DIR / "icon.png")
    images[-1].save(ICON_DIR / "icon.icns", format="ICNS", append_images=images[:-1])
    images[-1].save(
        ICON_DIR / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


def create_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    radius = max(4, size // 7)
    draw.rounded_rectangle(
        (0, 0, size - 1, size - 1),
        radius=radius,
        fill=(15, 118, 110, 255),
    )
    draw.rounded_rectangle(
        (size * 0.16, size * 0.22, size * 0.84, size * 0.74),
        radius=max(3, size // 18),
        fill=(236, 253, 245, 255),
    )
    draw.rectangle(
        (size * 0.22, size * 0.32, size * 0.78, size * 0.38),
        fill=(20, 184, 166, 255),
    )
    draw.rectangle(
        (size * 0.22, size * 0.48, size * 0.66, size * 0.54),
        fill=(20, 184, 166, 255),
    )
    draw.ellipse(
        (size * 0.58, size * 0.50, size * 0.88, size * 0.80),
        fill=(251, 191, 36, 255),
    )
    draw.line(
        (size * 0.68, size * 0.65, size * 0.76, size * 0.57, size * 0.84, size * 0.72),
        fill=(15, 23, 42, 255),
        width=max(2, size // 32),
        joint="curve",
    )
    if size >= 256:
        font = _font(size)
        draw.text(
            (size * 0.22, size * 0.76),
            "青影",
            fill=(255, 255, 255, 255),
            font=font,
        )
    return image


def _font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
    ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size // 8)
    return ImageFont.load_default()


if __name__ == "__main__":
    main()
