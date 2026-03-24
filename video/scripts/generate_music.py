#!/usr/bin/env python3
"""Generate music or sound effects using Meta's AudioCraft (MusicGen/AudioGen).

Requires GPU for reasonable speed. On CPU it will be very slow but still works.
"""
import sys
import argparse

def generate_music(prompt, duration=8, output="generated_music.wav", model_name="facebook/musicgen-small"):
    """Generate music from a text prompt."""
    from audiocraft.models import MusicGen
    from audiocraft.data.audio import audio_write

    print(f"Loading model: {model_name}")
    model = MusicGen.get_pretrained(model_name)
    model.set_generation_params(duration=duration)

    print(f"Generating {duration}s of music: '{prompt}'")
    wav = model.generate([prompt])

    audio_write(output.replace(".wav", ""), wav[0].cpu(), model.sample_rate, strategy="loudness")
    print(f"Saved: {output}")

def generate_sfx(prompt, duration=5, output="generated_sfx.wav"):
    """Generate sound effects from a text prompt."""
    from audiocraft.models import AudioGen
    from audiocraft.data.audio import audio_write

    print("Loading AudioGen model...")
    model = AudioGen.get_pretrained("facebook/audiogen-medium")
    model.set_generation_params(duration=duration)

    print(f"Generating {duration}s SFX: '{prompt}'")
    wav = model.generate([prompt])

    audio_write(output.replace(".wav", ""), wav[0].cpu(), model.sample_rate, strategy="loudness")
    print(f"Saved: {output}")

def main():
    parser = argparse.ArgumentParser(description="Generate music or SFX from text prompts")
    parser.add_argument("mode", choices=["music", "sfx"], help="Generate music or sound effects")
    parser.add_argument("prompt", help="Text description (e.g. 'upbeat electronic' or 'thunderstorm rain')")
    parser.add_argument("-d", "--duration", type=int, default=8, help="Duration in seconds (default: 8)")
    parser.add_argument("-o", "--output", default=None, help="Output filename (default: generated_<mode>.wav)")
    parser.add_argument("-m", "--model", default=None, help="Model name (music only, default: facebook/musicgen-small)")

    args = parser.parse_args()
    output = args.output or f"generated_{args.mode}.wav"

    if args.mode == "music":
        model = args.model or "facebook/musicgen-small"
        generate_music(args.prompt, args.duration, output, model)
    else:
        generate_sfx(args.prompt, args.duration, output)

if __name__ == "__main__":
    main()
