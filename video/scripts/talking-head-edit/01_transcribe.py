#!/usr/bin/env python3
"""WhisperX transcribe + forced alignment → word-level JSON."""
import json
import sys
import time

import torch
_orig_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs["weights_only"] = False
    return _orig_load(*args, **kwargs)
torch.load = _patched_load

try:
    from omegaconf.listconfig import ListConfig
    from omegaconf.dictconfig import DictConfig
    from omegaconf.base import ContainerMetadata, Metadata
    from omegaconf.nodes import AnyNode
    torch.serialization.add_safe_globals([
        ListConfig, DictConfig, ContainerMetadata, Metadata, AnyNode,
        list, dict, set, tuple, int, float, str, bool, type(None),
    ])
except Exception as _e:
    print(f"(allowlist skipped: {_e})")

import whisperx

AUDIO = "/tmp/anticheat-mic.wav"
OUT = "/tmp/anticheat-aligned.json"
LANG = "en"
DEVICE = "cpu"
COMPUTE = "int8"
BATCH = 16

t0 = time.time()
print(f"[1/3] Loading large-v3 ({COMPUTE}) on {DEVICE}…", flush=True)
model = whisperx.load_model("large-v3", DEVICE, compute_type=COMPUTE, language=LANG)

print(f"[2/3] Transcribing {AUDIO}…", flush=True)
audio = whisperx.load_audio(AUDIO)
result = model.transcribe(audio, batch_size=BATCH, language=LANG)
print(f"  segments: {len(result['segments'])}", flush=True)

print(f"[3/3] Loading wav2vec2 alignment ({LANG}) and aligning…", flush=True)
align_model, metadata = whisperx.load_align_model(language_code=LANG, device=DEVICE)
aligned = whisperx.align(
    result["segments"], align_model, metadata, audio, DEVICE,
    return_char_alignments=False,
)
aligned["language"] = LANG
json.dump(aligned, open(OUT, "w"), indent=2, ensure_ascii=False)
print(f"done in {time.time() - t0:.1f}s → {OUT}", flush=True)
print(f"words: {sum(len(s.get('words', [])) for s in aligned['segments'])}")
