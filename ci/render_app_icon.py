"""Original iPhone icon: an open notebook and a small lamp. Not the upstream logo."""
import struct
import zlib
from pathlib import Path


def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png(width, height, rows):
    raw = bytearray()
    for row in rows:
        raw.append(0)
        raw.extend(row)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(
        b"IDAT", zlib.compress(bytes(raw), 9)
    ) + chunk(b"IEND", b"")


def render(size=1024):
    pixels = bytearray()
    for y in range(size):
        for x in range(size):
            nx = x / size
            ny = y / size
            cover = 0.12 < nx < 0.88 and 0.14 < ny < 0.86
            page = 0.18 < nx < 0.80 and 0.20 < ny < 0.80
            fold = page and abs(nx - 0.49) < 0.015
            lamp = (nx - 0.72) ** 2 + (ny - 0.30) ** 2 < 0.018
            if lamp:
                color = (244, 184, 74)
            elif fold:
                color = (47, 93, 122)
            elif page:
                color = (244, 247, 251)
            elif cover:
                color = (18, 74, 104)
            else:
                color = (10, 28, 46)
            pixels.extend(color)
    rows = [pixels[y * size * 3:(y + 1) * size * 3] for y in range(size)]
    return png(size, size, rows)


if __name__ == "__main__":
    destination = Path(__file__).resolve().parents[1] / "resources" / "AppIcon-1024.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(render())
    print(destination)
