"""Extract a registered reading object without executing the file."""
import json
import re

REGISTER = re.compile(
    r"""\.register\(\s*(['"])(?P<id>[A-Za-z0-9][A-Za-z0-9._-]{0,80})\1\s*,""",
    re.S,
)


class SourceRejected(ValueError):
    pass


def extract_registered_object(source: str):
    if not isinstance(source, str) or len(source) > 2_000_000:
        raise SourceRejected("file is empty or too large")
    if "\x00" in source:
        raise SourceRejected("file contains a null byte")
    match = REGISTER.search(source)
    if not match:
        raise SourceRejected("missing register(id, object) wrapper")
    start = match.end()
    while start < len(source) and source[start].isspace():
        start += 1
    if start >= len(source) or source[start] != "{":
        raise SourceRejected("register payload is not a JSON object")
    end = _matching_brace(source, start)
    payload = source[start:end]
    if re.search(r"\b(?:eval|Function|new\s+Function)\b", payload):
        raise SourceRejected("payload contains executable syntax")
    try:
        value = json.loads(payload)
    except json.JSONDecodeError as error:
        raise SourceRejected(f"payload is not JSON: {error.msg}") from error
    if not isinstance(value, dict):
        raise SourceRejected("payload is not an object")
    exam_id = match.group("id")
    declared = str(value.get("examId") or exam_id)
    if declared != exam_id:
        raise SourceRejected("examId does not match register id")
    return exam_id, value


def _matching_brace(source: str, start: int) -> int:
    depth = 0
    in_string = False
    escape = False
    for index in range(start, len(source)):
        char = source[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index + 1
    raise SourceRejected("JSON object was not closed")
