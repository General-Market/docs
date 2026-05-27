#!/usr/bin/env python3
"""Launcher for the xwatch daemon.

launchd's `-m xwatch.main` proved unreliable even with PYTHONPATH set, so this
pins the package's parent directory onto sys.path from the launcher's own
absolute location — no dependence on cwd, PYTHONPATH, or how it's invoked.

    python3 /abs/path/to/docs/x-targeting/run_xwatch.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from xwatch.main import main  # noqa: E402

if __name__ == "__main__":
    main()
