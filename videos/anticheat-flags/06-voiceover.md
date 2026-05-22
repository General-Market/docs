# Phase 6 — Voix-off

The image can be ugly. The sound cannot. The mic flattens the voice by half a register and the listener cannot see the face, so the voice must do the work both would normally share.

This file is two things at once. Read top to bottom *before* the recording, then come back and fill the *Take notes* and *Post-process* sections during and after. The recording session writes its own truth into the same file the playbook lives in.

---

## Equipment ladder

The script is twenty minutes. The microphone matters more than any other piece of gear in this project. Five rungs, choose one:

| Budget | Setup | Notes |
|---|---|---|
| None | Phone microphone, in a small closet, mouth six inches away. | Surprisingly usable. The clothes in the closet are the absorber. A bath towel on a coat hanger held next to the mouth works too. |
| ~€50 | **BIRD UM1 USB.** | The first real microphone. Plug-and-record, no interface. |
| ~€100 | **Rode NT1 USB** *or* **Blue Yeti** *or* **Shure MV6.** | Three different colours; all good. The NT1 USB is the kindest to a male voice; the MV6 ships with the on-board processing that nearly matches a SM7B. |
| ~€250 | **Shure SM7B + Behringer UMC202HD.** | The internet standard for spoken-word YouTube. Forgiving of room acoustics. |
| ~€400 | **Rode NT1 XLR + Focusrite Scarlett Solo G3.** | Cleaner than the SM7B for a quiet voice, less forgiving of a noisy room. |

If you already own one of these, use it. If you do not, the BIRD UM1 at fifty euros is the rung where the curve turns sharply — anything below sounds amateur, anything above sounds professional, and the gap between fifty and four hundred is much smaller than the gap between phone and fifty.

## Room

The room matters more than the microphone after the first rung. A bedroom with curtains and a bed in it is better than a kitchen. A closet with hanging clothes is better than a bedroom. A car interior is better than a kitchen.

What to check:
- Phone on aeroplane mode. Notifications off everywhere.
- Window closed. Air conditioner, heating, fan — off. Fridge in the next room can survive; a fan in the same room cannot.
- A glass of water on the desk. Not cold — cold tightens the throat. Room temperature.
- Pop filter if you have one; otherwise a piece of pantyhose stretched over a coat-hanger ring three inches in front of the mic does the same job for free.

## Posture

The mic sits six inches from the mouth, slightly off-axis — pointed at the cheek rather than the lips, fifteen to thirty degrees off centre. This is the single change that cuts plosives by half before the EQ touches them.

You speak at conversational volume *plus twenty percent*. The mic flattens energy; over-emote a little to compensate, and the recording will sound natural rather than read.

Declaim to a listener. A plush toy on the desk, a coffee mug, a friend on a silent video call — anything that listens. Without a listener, a good script sounds *read*; with one, the same script sounds *said*. This is the largest single lift available to an amateur voice-over.

## The take

The whole script in one pass. Twenty minutes, top to bottom. When you stumble — and you will — clap once into the mic and read the sentence again from the start. The clap leaves a visible spike in the waveform and you will find each bad take in two seconds during post.

When the script ends, *do not stop the recording*. Keep the mic open. Hold a full second of room silence with no movement and no breath. This is your *noise sample* — the post-process needs it to remove the room from every other line. A take without a noise sample is harder to clean.

### Musicality — two rules to honour

The skill names these for French speech; they survive in English by ear.

1. **A sentence starts higher and lands lower.** As you approach the period, the voice drops. Never end a sentence higher than where it started; that is the rising inflection of a question, and the script asks very few questions.
2. **Never hold the same tone for two sentences in a row.** Vary phrase to phrase. The monotone is what kills a video faster than any bad idea — every viewer has met the teacher who droned, and they will not stay for the same voice.

### Voice tics — keep them, sparingly

The small hesitations that perform unscriptedness — *and so*, *well*, a drawn *now*, a single small *huh* — are tools, not bugs. The script is written for the mouth; let the mouth shape the line if it wants to. A line that reads *"The third — Sameer Ramani — fled"* on the page is allowed to land as *"And the third — Sameer Ramani — fled"* on the take. The apprentice's instinct is the right one in the room.

### Lines that need extra care

Two paragraphs were flagged in the script's own audit. The recording session honours them now, before the post-process:

- **P16** (Kalshi class action). Second-longest sentence. The em-dash before *"meaning the peer-to-peer exchange…"* is a *real* pause — a full beat, not a comma. Said too quickly, the sentence runs together and the punchline disappears.
- **P28** (UTS study). The parenthetical *"could not, politely, explain"* needs the two commas as real beats. Said quickly, it sounds clever. Said with the commas honoured, it sounds *damning*.

### The anaphoric beat — P35

Six *"No ___"* clauses in a row. Vary the pitch and the emphasis across them; otherwise the sequence reads as robotic. The skill rule: *never hold the same tone for two phrases in a row* applies six times in this paragraph alone.

### The silent beats — P7, P26, P37

The mic stays open. You do not shuffle, do not breathe loudly, do not adjust the chair. Three seconds of stillness, then the next line. The room tone fills the gap; the listener feels the weight of the silence; the edit honours it without effort.

---

## Post-process recipe — the order matters

In Audacity or any equivalent DAW. The order is more important than the parameters; do not compress before you clean.

1. **Import** the take at the original sample rate. Do not resample yet.
2. **Select the 1-second noise sample** at the end of the take. Effect → *Noise Reduction* → *Get Noise Profile*.
3. **Apply noise reduction across the whole track.** Default values are usually right: 12 dB reduction, sensitivity 6, frequency smoothing 3. If the result sounds like a swimming pool, lower the reduction to 9 dB; if the room hiss is still present, raise sensitivity to 8 before raising reduction.
4. **Filter Curve EQ** to suppress plosives. A high-pass at 80 Hz removes most rumble. A gentle dip of −3 dB centred at 150 Hz softens the *b*, *p*, *v* hits. Do not overdo the dip; too much and the voice loses chest.
5. **Cut bad takes.** Walk the timeline. Each clap-marked spike is a take to remove. Cut between sentences, never inside one.
6. **Truncate silence.** Effect → *Truncate Silence*. Cap any gap longer than 200 milliseconds at 200 milliseconds. The two silent beats (P7, P26, P37) need to be re-extended manually back to the three-second hold the script asks for — *do this after the truncate pass*, not before.
7. **Compression — last, not first.** Ratio 3:1, threshold around −18 dBFS, attack 20 ms, release 200 ms. Listen on headphones; if the voice sounds *squashed*, lower the ratio to 2.5:1. Compression should be felt, not heard.
8. **Limiter at −3 dBFS peak ceiling.** This is the single most important step in the whole recipe. A clipped consonant on the master is worse than every other rule combined; the limiter prevents it.
9. **Normalize** the loudest passages to between −9 and −3 dBFS. The standard target for spoken YouTube is around −6 dBFS peak, with average around −16 LUFS.
10. **Export** as 48 kHz, 24-bit WAV (uncompressed) for the edit. The MP3 export is for review only.

The whole chain takes about thirty minutes for a twenty-minute take, the first time. With practice it lands at fifteen.

---

## Recording day — take notes

*Fill this section during and after the session.*

- **Date of recording:**
- **Equipment used:** (mic, interface, room)
- **Room conditions:** (background noise level, time of day, anything unusual)
- **Number of takes:** (one is the goal; two is acceptable; three means the script needs a re-read before take four)
- **Lines that needed multiple attempts:**
- **Lines that landed on the first try better than expected:**
- **Anything in the script that did not survive the mouth:** (rewrite candidates for phase 5b's read-aloud loop)
- **Total recorded length:** (script-target was 19–20 min; if you came in significantly shorter or longer, the script's pacing was wrong, not your delivery)

## Post-process — recipe applied

*Fill this section after the cleanup pass.*

- **Noise reduction:** dB reduction = , sensitivity = , artefacts heard =
- **EQ:** high-pass at = , dip frequency / depth =
- **Compression:** ratio = , threshold = , attack = , release =
- **Limiter ceiling:** dBFS
- **Final peak level:** dBFS
- **Final average level / LUFS:**
- **Total processed length:** (after truncate and re-extended silences)

## Files written

- `06-voiceover/take-01.wav` — the raw take with the noise sample at the end
- `06-voiceover/take-01-processed.wav` — the cleaned, compressed, limited version that the editor in phase 7 imports

---

## Checkpoint

Listen to the processed take in headphones, end to end. Mark every place where:

- a plosive survived the EQ (the *p* of *PFOF*, the *b* of *backtest*, the *p* of *pump dot fun*)
- a mouth click survives the noise reduction
- the room tone changes (a fridge clicked on mid-take; an air-con cycle started)
- a silent beat is shorter than three seconds (it must be three, not two and a half)

When the take is clean, phase 7 — *Montage* — opens. The editor in phase 7 inherits the locked voice track as the spine of the timeline.

*Image is forgiveable. Sound is not.*
