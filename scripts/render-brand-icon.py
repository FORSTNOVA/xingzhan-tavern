"""Preview the Android mascot launcher icon with common launcher masks."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "app/src/main/res/drawable-nodpi/xingzhan_mascot.png"
OUTPUT = ROOT / "artifacts/branding/xingzhan-icon-preview.png"
BACKGROUND = "#20243F"
SIZE = 416


def main():
    mascot = Image.open(SOURCE).convert("RGBA")
    foreground_size = round(SIZE * 88 / 108)
    foreground = mascot.resize((foreground_size, foreground_size), Image.Resampling.LANCZOS)
    icon = Image.new("RGBA", (SIZE, SIZE), BACKGROUND)
    inset = (SIZE - foreground_size) // 2
    icon.alpha_composite(foreground, (inset, inset))

    preview = Image.new("RGB", (1024, 512), "#F0EEE9")
    for index, shape in enumerate(("rounded", "circle")):
        mask = Image.new("L", (SIZE, SIZE), 0)
        draw = ImageDraw.Draw(mask)
        if shape == "circle":
            draw.ellipse((0, 0, SIZE - 1, SIZE - 1), fill=255)
        else:
            draw.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=round(SIZE * 0.24), fill=255)
        preview.paste(icon.convert("RGB"), (index * 512 + 48, 48), mask)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    preview.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
