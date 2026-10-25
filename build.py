#!/usr/bin/env python3
"""Собирает сайт egel22.ru в папку site/.

Берёт задания из базы ege-bank (по умолчанию ../EGE/ege-bank/data) и интерфейс из src/.
Запуск: python build.py [папка_с_ege.db]   или двойной щелчок по build.bat.
Ответы в открытом виде на сайт не попадают, только sha256 от «номер:часть:ответ» из ege.db.
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "tools"))
from bank import Bank  # noqa: E402

SRC = ROOT / "src"
OUT = ROOT / "site"
DEFAULT_BANK = ROOT.parent / "EGE" / "ege-bank" / "data"


def dump(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def sync_media(src: Path, dst: Path) -> int:
    """Копирует картинки и файлы к задачам: только новые и изменившиеся."""
    copied = 0
    for f in src.rglob("*"):
        if not f.is_file():
            continue
        t = dst / f.relative_to(src)
        if t.exists() and t.stat().st_size == f.stat().st_size:
            continue
        t.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, t)
        copied += 1
    return copied


def main():
    bank_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_BANK
    bank = Bank(bank_dir)

    for sub in ("data", "static"):
        shutil.rmtree(OUT / sub, ignore_errors=True)

    # задания
    numbers, cards = [], {}
    for n in bank.numbers:
        main_ids, extra_ids = bank.ids(n, "main"), bank.ids(n, "extra")
        numbers.append({"n": n, "title": bank.titles[n], "main": main_ids,
                        "extra": [[i, len(bank.tasks[i].parts)] for i in extra_ids]})
        for tier, ids in (("main", main_ids), ("extra", extra_ids)):
            html = bank.html_many(ids)
            tasks, tcards = {}, {}
            for i in ids:
                t = bank.tasks[i]
                tcards[i] = {"label": t.label, "year": t.year if tier == "main" else None, "preview": t.preview,
                             "old_format": t.old_format, "parts": len(t.parts)}
                tasks[i] = {"html": html[i], "attribution": t.attribution,
                            "parts": [{"ege_no": p.ege_no, "rows": p.rows, "cols": p.cols,
                                       "keyboard": p.keyboard, "hash": p.hash} for p in t.parts]}
            if tier == "main":
                cards.update(tcards)
                dump(OUT / "data" / "main" / f"{n}.json", tasks)
            else:
                dump(OUT / "data" / "extra" / f"{n}.json", {"cards": tcards, "tasks": tasks})
    dump(OUT / "data" / "index.json", {"version": bank.version, "numbers": numbers, "cards": cards})

    # версия сайта: меняется, когда поменялись задания или интерфейс, и браузеры берут свежие файлы
    h = hashlib.sha1(bank.version.encode())
    for f in sorted((OUT / "data").rglob("*.json")):
        h.update(f.read_bytes())
    for f in sorted(SRC.rglob("*")):
        if f.is_file() and f.suffix in (".html", ".js", ".css", ".webmanifest"):
            h.update(f.read_bytes())
    version = h.hexdigest()[:8]

    # интерфейс
    shutil.copytree(SRC, OUT / "static", ignore=shutil.ignore_patterns("index.html"))
    for f in [OUT / "static" / "app.js"]:
        f.write_text(f.read_text(encoding="utf-8").replace("__V__", version), encoding="utf-8")
    (OUT / "index.html").write_text((SRC / "index.html").read_text(encoding="utf-8").replace("__V__", version), encoding="utf-8")
    (OUT / "robots.txt").write_text("User-agent: *\nAllow: /\n", encoding="utf-8")

    # картинки и файлы к задачам
    media = bank_dir / "media"
    copied = sync_media(media, OUT / "media") if media.exists() else 0
    if not media.exists():
        print(f"Внимание: нет папки {media}")

    size = sum(f.stat().st_size for f in (OUT / "data").rglob("*.json")) / 1e6
    print(f"Готово: site/  версия {version}, задач {len(bank.tasks)}, данные {size:.1f} МБ, новых файлов {copied}")


if __name__ == "__main__":
    main()
