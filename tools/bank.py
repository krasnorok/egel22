"""Банк заданий из ege-bank (ege.db): порядок задач и деление на основные и дополнительные.
Копия логики бота, чтобы сайт собирался сам по себе.

Ярусы:
  main  - официальные задания (ЕГЭ, досрочный, открытый вариант, апробация, демо) с MAIN_FROM_YEAR года.
  extra - всё остальное (авторские, ЕГКР, сайты, без источника, официальные старого формата).
          Открываются в номере, когда в нём решены все main.
"""
import hashlib
import json
import re
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path

MAIN_FROM_YEAR = 2022  # с какого года официальные задания идут в основной список

EXAM_KINDS = [  # порядок внутри одного года: основной экзамен важнее демо
    ("досрочн", 1, "Досрочный ЕГЭ"),
    ("открытый", 2, "Открытый вариант"),
    ("апробац", 3, "Апробация"),
    ("пробный", 5, "Пробный КЕГЭ"),
    ("демо", 4, "Демоверсия"),
    ("егэ", 0, "ЕГЭ"),
]


@dataclass
class Part:
    ege_no: int
    rows: int
    cols: int
    hash: str
    answer: str
    keyboard: str  # numeric | text


@dataclass
class Task:
    id: int
    n: int
    tier: str
    kind: str
    year: int | None
    label: str
    author: str | None
    old_format: bool
    preview: str
    attribution: str
    orig_url: str
    parts: list[Part] = field(default_factory=list)


def _exam_label(title: str, year: int | None):
    t = title.lower()
    for key, rank, name in EXAM_KINDS:
        if key in t:
            return rank, f"{name} {year}" if year else name
    return 9, title


_SKIP = re.compile(r"^(В ответе|Ответ|Запишите|Примечание|Например|Пример)", re.I)


def _preview(text: str, n=150) -> str:
    """Вопрос задачи, а не начало условия: у задач одного номера начало обычно одинаковое."""
    s = re.sub(r"\s+", " ", text.replace("[рисунок]", " ")).strip()
    sentences = [x.strip() for x in re.split(r"(?<=[.?!])\s+(?=[А-ЯЁA-Z])", s) if x.strip()]
    useful = [x for x in sentences if not _SKIP.match(x) and len(x) > 25]
    pick = useful[-1] if useful else s
    if len(pick) < 60 and len(useful) > 1:
        pick = useful[-2] + " " + pick
    return pick if len(pick) <= n else pick[: n - 1].rsplit(" ", 1)[0] + "…"


class Bank:
    def __init__(self, bank_dir: Path):
        self.db_path = Path(bank_dir) / "ege.db"
        if not self.db_path.exists():
            near = sorted(p.name for p in self.db_path.parent.parent.iterdir()) if self.db_path.parent.parent.exists() else []
            raise RuntimeError(f"Нет базы заданий {self.db_path}. Рядом лежит: {near}.")
        db = self._open()
        self.titles = {}
        for n, title in db.execute("SELECT ege_no, title FROM kim_numbers"):
            self.titles[n] = "Теория игр" if n == 19 else title.strip()
        plain = {}
        with open(Path(bank_dir) / "answers_PRIVATE.jsonl", encoding="utf-8") as f:
            for line in f:
                r = json.loads(line)
                plain[(r["task_id"], r["ege_no"])] = r["answer"]
        parts: dict[int, list[Part]] = {}
        for tid, e, h, rows, cols in db.execute(
                "SELECT task_id, ege_no, hash, rows, cols FROM answer_keys ORDER BY task_id, ege_no"):
            a = plain.get((tid, e), "")
            kb = "numeric" if re.fullmatch(r"[0-9 \n]*", a) else "text"
            parts.setdefault(tid, []).append(Part(e, rows, cols, h, a, kb))

        self.tasks: dict[int, Task] = {}
        keys = {}
        for (tid, n, kind, title, year, author, official, attribution, url, text) in db.execute(
                "SELECT id, ege_no, source_kind, source_title, source_year, author, is_official, "
                "attribution, orig_url, text_plain FROM tasks"):
            old = bool(official and year and year < MAIN_FROM_YEAR)
            tier = "main" if official and not old else "extra"
            if kind == "exam":
                rank, label = _exam_label(title or "", year)
            elif kind == "egkr":
                rank, label = 9, f"ЕГКР {year}" if year else "ЕГКР"
            elif kind == "author":
                rank, label = 9, author
            elif kind == "other":
                rank, label = 9, title
            else:
                rank, label = 9, "Тренировочная"
            if tier == "main":
                key = (0, -(year or 0), rank, -tid)
            else:
                key = (1, 1 if old else 0, -tid)
            keys[tid] = key
            if kind == "author":
                attribution = f"Автор задачи: {author}"
            elif kind == "unspecified":
                attribution = "Тренировочная задача"
            else:
                attribution = f"Источник: {title}"
            self.tasks[tid] = Task(tid, n, tier, kind, year, label, author, old, _preview(text),
                                   attribution, url, parts.get(tid, []))
        db.close()

        self.order: dict[tuple[int, str], list[int]] = {}
        for tid in sorted(self.tasks, key=keys.get):
            t = self.tasks[tid]
            self.order.setdefault((t.n, t.tier), []).append(tid)
        self.numbers = sorted(self.titles)
        parts_all = [f"{tid}:{p.ege_no}" for tid in sorted(self.tasks) for p in self.tasks[tid].parts]
        self.version = hashlib.sha1(",".join(parts_all).encode()).hexdigest()[:8]

    def _open(self):
        # immutable=1: файл только читаем, SQLite не создаёт рядом служебных файлов
        return sqlite3.connect(f"file:{self.db_path.as_posix()}?mode=ro&immutable=1", uri=True)

    def html_many(self, ids: list[int]) -> dict[int, str]:
        db = self._open()
        try:
            out = {}
            for i in range(0, len(ids), 500):
                chunk = ids[i:i + 500]
                q = f"SELECT id, html FROM tasks WHERE id IN ({','.join('?' * len(chunk))})"
                out.update(dict(db.execute(q, chunk).fetchall()))
            return out
        finally:
            db.close()

    def html(self, tid: int) -> str:
        db = self._open()
        try:
            return db.execute("SELECT html FROM tasks WHERE id=?", (tid,)).fetchone()[0]
        finally:
            db.close()

    def ids(self, n: int, tier: str) -> list[int]:
        return self.order.get((n, tier), [])

    def points(self, n: int, tier: str) -> int:
        """Сколько баллов-частей в номере (19–21 = 3 на задачу)."""
        return sum(len(self.tasks[i].parts) for i in self.ids(n, tier))
