import asyncio
from pathlib import Path

from apk_forensics import check_tool, run
from models import Job

CONTEXT_LINES = 8
APKTOOL_TIMEOUT = 60


async def get_code_snippet(job: Job, file: str, line: int, category: str) -> dict:
    if not file:
        return {"available": False, "reason": "no_location"}

    if category == "Secret (Java)":
        if not job.decompiled_path:
            return {"available": False, "reason": "source_not_found"}
        base_path = Path(job.decompiled_path).resolve()
        rel = file[len("jadx_out/"):] if file.startswith("jadx_out/") else file
        return _read_window(base_path, rel, line)

    return await _resolve_via_apktool(job, file, line)


async def _resolve_via_apktool(job: Job, file: str, line: int) -> dict:
    if not job.file_path:
        return {"available": False, "reason": "source_not_found"}
    apk_path = Path(job.file_path).resolve()
    if not apk_path.exists():
        return {"available": False, "reason": "source_not_found"}

    # El output de apktool no se persiste durante el análisis normal (vive en
    # un workdir temporal que se borra al terminar) — acá lo re-generamos una
    # sola vez por job y lo dejamos cacheado junto al APK, igual que ya se
    # hace con jadx_out, para que un segundo click sobre el mismo job no
    # vuelva a correr apktool.
    cache_dir = apk_path.parent / "apktool_out"
    if not cache_dir.exists():
        if not check_tool("apktool"):
            return {"available": False, "reason": "tool_missing"}
        loop = asyncio.get_running_loop()
        rc, _, _ = await loop.run_in_executor(
            None, run, ["apktool", "d", "-f", "-o", str(cache_dir), str(apk_path)], None, APKTOOL_TIMEOUT
        )
        if rc != 0 and not cache_dir.exists():
            return {"available": False, "reason": "source_not_found"}

    rel = file[len("apktool_out/"):] if file.startswith("apktool_out/") else file
    return _read_window(cache_dir.resolve(), rel, line)


HEX_WINDOW_BYTES = 128


def _looks_binary(text: str) -> bool:
    # Los .so nativos (ej. libflutter.so) matchean patrones de "posible
    # secreto"/"posible clave" por pura casualidad de bytes — igual que ya
    # pasa en analyze_strings, que no filtra .so. Se evalúa solo la ventana
    # que efectivamente se va a mostrar (no el archivo entero), porque un
    # binario puede tener secciones de texto embebido legibles: si esa
    # ventana puntual tiene muchos caracteres de control o de reemplazo, no
    # es texto real y hay que mostrar hex en vez de fingir que es código.
    if not text:
        return False
    suspicious = sum(1 for c in text if c == "�" or (ord(c) < 32 and c not in "\n\r\t"))
    return suspicious / len(text) > 0.05


def _byte_offset_for_line(raw: bytes, line: int) -> int:
    # apk_forensics calcula la línea de un match con
    # content[:match.start()].count("\n") + 1 sobre el texto decodificado
    # con errors="replace" — el byte 0x0A siempre decodifica a "\n" 1:1, así
    # que contar bytes 0x0A crudos da el mismo número de línea sin tener que
    # volver a decodificar todo el archivo acá.
    parts = raw.split(b"\n")
    offset = 0
    for part in parts[: max(line - 1, 0)]:
        offset += len(part) + 1
    return min(offset, max(len(raw) - 1, 0))


def _hex_dump(data: bytes, center_offset: int, window: int = HEX_WINDOW_BYTES) -> str:
    start = max(0, center_offset - window)
    start -= start % 16
    end = min(len(data), center_offset + window)
    chunk = data[start:end]

    rows = []
    for i in range(0, len(chunk), 16):
        row = chunk[i : i + 16]
        offset = start + i
        hex_part = " ".join(f"{b:02x}" for b in row)
        ascii_part = "".join(chr(b) if 32 <= b < 127 else "." for b in row)
        marker = ">" if offset <= center_offset < offset + 16 else " "
        rows.append(f"{marker} {offset:08x}  {hex_part:<47}  |{ascii_part}|")
    return "\n".join(rows)


def _read_window(base_path: Path, rel: str, line: int) -> dict:
    target = (base_path / rel).resolve()
    if not str(target).startswith(str(base_path)):
        return {"available": False, "reason": "source_not_found"}
    if not target.exists() or not target.is_file():
        return {"available": False, "reason": "source_not_found"}

    try:
        raw = target.read_bytes()
    except Exception:
        return {"available": False, "reason": "source_not_found"}
    if not raw:
        return {"available": False, "reason": "source_not_found"}

    content = raw.decode("utf-8", errors="replace")
    lines = content.splitlines()
    if not lines:
        return {"available": False, "reason": "source_not_found"}

    target_line = line if line and line > 0 else 1
    start = max(1, target_line - CONTEXT_LINES)
    end = min(len(lines), target_line + CONTEXT_LINES)
    snippet = "\n".join(lines[start - 1 : end])

    if _looks_binary(snippet):
        offset = _byte_offset_for_line(raw, target_line)
        return {
            "available": True,
            "file": rel.replace("\\", "/"),
            "line": target_line,
            "is_binary": True,
            "snippet": _hex_dump(raw, offset),
        }

    return {
        "available": True,
        "file": rel.replace("\\", "/"),
        "line": target_line,
        "start_line": start,
        "end_line": end,
        "snippet": snippet,
    }
