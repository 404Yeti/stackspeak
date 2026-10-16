# StackSpeak runner harness — executed inside the worker's Pyodide interpreter BEFORE student code,
# and (in snapshot mode) captured in the memory snapshot. It defines two functions:
#   _prepare()  called on every fresh interpreter (cold or restored from a snapshot)
#   _run(code)  runs student code in a brand-new namespace and returns a JSON string
#
# Nothing here is a security boundary — the boundary is the browser (cross-site origin + worker CSP).
import json
import random
import sys
import traceback

_MAX_TB = 8192


def _prepare():
    # A restored snapshot freezes the PRNG state: every fresh interpreter would otherwise print the
    # same "random" numbers. Reseed from the platform entropy source on every boot.
    random.seed()
    return True


def _format_exc(exc):
    tbe = traceback.TracebackException.from_exception(exc)
    # Show only the student's own frames (main.py), never harness or interpreter internals.
    tbe.stack = traceback.StackSummary.from_list(
        [(f.filename, f.lineno, f.name, f.line) for f in tbe.stack if f.filename == "main.py"]
    )
    return "".join(tbe.format())[:_MAX_TB]


def _flush_quietly():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.flush()
        except BaseException:
            pass  # e.g. the output cap already tripped; the run result carries that fact


def _run(code):
    namespace = {"__name__": "__main__", "__file__": "main.py"}
    try:
        compiled = compile(code, "main.py", "exec")
    except (SyntaxError, ValueError) as exc:  # ValueError: e.g. null bytes in source
        return json.dumps(
            {
                "status": "syntax-error",
                "exception": type(exc).__name__,
                "traceback": "".join(traceback.format_exception_only(type(exc), exc))[:_MAX_TB],
            }
        )
    try:
        exec(compiled, namespace)
    except SystemExit:
        _flush_quietly()
        return json.dumps({"status": "ok"})
    except BaseException as exc:  # noqa: BLE001 - student code may raise anything
        _flush_quietly()
        return json.dumps(
            {"status": "exception", "exception": type(exc).__name__, "traceback": _format_exc(exc)}
        )
    _flush_quietly()
    return json.dumps({"status": "ok"})
