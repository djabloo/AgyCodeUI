#!/usr/bin/env python3
"""
Motore vocale condiviso del Notebook: Edge (gratuito) oppure ElevenLabs (chiave
dell'utente). Usato da generate_audio_overview.py e generate_video_presentation.py.

La configurazione arriva SOLO da variabili d'ambiente impostate da server.js
(mai da argomenti: la chiave non deve comparire in `ps`):
  NOTEBOOK_TTS_PROVIDER   edge | elevenlabs           (default edge)
  ELEVENLABS_API_KEY      chiave dell'utente
  ELEVENLABS_MODEL        default eleven_multilingual_v2
  ELEVENLABS_VOICE_A      voce 1 (Diego / narratore)
  ELEVENLABS_VOICE_B      voce 2 (Elsa)

Nessuna dipendenza nuova: ElevenLabs si chiama con urllib della libreria standard.
"""

import asyncio
import json
import os
import subprocess
import time
import urllib.error
import urllib.request

EDGE_VOICES = {"A": "it-IT-DiegoNeural", "B": "it-IT-ElsaNeural"}

# Voci "premade" disponibili su ogni account ElevenLabs; con i modelli
# multilingua parlano italiano. L'utente puo' sceglierne altre dalla sua libreria.
ELEVEN_DEFAULT_VOICES = {
    "A": "JBFqnCBsd6RMkjVDRZzb",  # George
    "B": "EXAVITQu4vr4xnAE8sDL",  # Sarah
}
ELEVEN_DEFAULT_MODEL = "eleven_multilingual_v2"
ELEVEN_OUTPUT_FORMAT = "mp3_44100_128"
# I piani ElevenLabs limitano le richieste contemporanee (2-15 a seconda del piano).
ELEVEN_CONCURRENCY = int(os.environ.get("ELEVENLABS_CONCURRENCY", "3"))

# Formato comune di tutti i segmenti prima della concatenazione: Edge esce a
# 24 kHz, ElevenLabs a 44.1 kHz, il silenzio va generato uguale. Con parametri
# identici il concat di ffmpeg puo' copiare senza ricodificare.
NORM_ARGS = ["-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "96k"]


class TTSError(Exception):
    pass


def provider():
    p = (os.environ.get("NOTEBOOK_TTS_PROVIDER") or "edge").strip().lower()
    return "elevenlabs" if p == "elevenlabs" else "edge"


def provider_label():
    return "ElevenLabs" if provider() == "elevenlabs" else "Microsoft Edge"


def _eleven_voice(slot):
    return (os.environ.get(f"ELEVENLABS_VOICE_{slot}") or "").strip() or ELEVEN_DEFAULT_VOICES[slot]


async def _edge(text, slot, out_path):
    import edge_tts
    comm = edge_tts.Communicate(text, EDGE_VOICES[slot])
    await comm.save(out_path)


def _eleven_request(text, voice_id, out_path, previous_text=None, next_text=None):
    key = (os.environ.get("ELEVENLABS_API_KEY") or "").strip()
    if not key:
        raise TTSError("Chiave ElevenLabs mancante: inseriscila nelle impostazioni voci del Notebook.")
    model = (os.environ.get("ELEVENLABS_MODEL") or "").strip() or ELEVEN_DEFAULT_MODEL
    payload = {"text": text, "model_id": model}
    # Contesto delle battute vicine: migliora intonazione e continuita'.
    # eleven_v3 non lo supporta.
    if not model.startswith("eleven_v3"):
        if previous_text:
            payload["previous_text"] = previous_text[-500:]
        if next_text:
            payload["next_text"] = next_text[:500]
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format={ELEVEN_OUTPUT_FORMAT}"
    data = json.dumps(payload).encode("utf-8")

    delay = 2.0
    for attempt in range(5):
        req = urllib.request.Request(url, data=data, method="POST", headers={
            "xi-api-key": key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        })
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                with open(out_path, "wb") as f:
                    f.write(resp.read())
            return
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", "replace")
            except Exception:
                pass
            detail = body
            try:
                d = json.loads(body).get("detail")
                detail = (d.get("message") if isinstance(d, dict) else d) or body
            except Exception:
                pass
            if e.code == 401:
                raise TTSError("Chiave ElevenLabs non valida o senza permesso di sintesi vocale.")
            if e.code == 402 or "quota" in str(detail).lower():
                raise TTSError("Credito ElevenLabs esaurito per questo mese: ricarica o torna alle voci Edge.")
            if e.code == 404 or "voice_not_found" in body:
                raise TTSError(f"Voce ElevenLabs {voice_id} non trovata nel tuo account: scegline un'altra nelle impostazioni.")
            if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(delay)
                delay *= 2
                continue
            raise TTSError(f"ElevenLabs HTTP {e.code}: {str(detail)[:300]}")
        except urllib.error.URLError as e:
            if attempt < 4:
                time.sleep(delay)
                delay *= 2
                continue
            raise TTSError(f"ElevenLabs non raggiungibile: {e.reason}")


async def synthesize_all(items):
    """
    items: lista di dict {text, slot ('A'|'B'), out}.
    Sintetizza tutto con il provider configurato, in parallelo ma entro i limiti.
    """
    if provider() == "elevenlabs":
        sem = asyncio.Semaphore(max(1, ELEVEN_CONCURRENCY))

        async def one(i, it):
            async with sem:
                prev_t = items[i - 1]["text"] if i > 0 else None
                next_t = items[i + 1]["text"] if i + 1 < len(items) else None
                await asyncio.to_thread(_eleven_request, it["text"], _eleven_voice(it["slot"]), it["out"], prev_t, next_t)

        await asyncio.gather(*[one(i, it) for i, it in enumerate(items)])
    else:
        sem = asyncio.Semaphore(8)

        async def one_edge(it):
            async with sem:
                await _edge(it["text"], it["slot"], it["out"])

        await asyncio.gather(*[one_edge(it) for it in items])


def _ffmpeg(args):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        raise TTSError("ffmpeg: " + r.stderr.decode("utf-8", "replace")[-400:])


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1", path],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        return float(r.stdout.decode().strip())
    except ValueError:
        return 0.0


def concat(segments, out_path, tmpdir, gap=0.35):
    """
    Normalizza i segmenti, li unisce con una breve pausa e ritorna la lista
    degli istanti di inizio (secondi) di ciascun segmento nel file finale.
    """
    norm = []
    for i, s in enumerate(segments):
        n = os.path.join(tmpdir, f"norm_{i:03d}.mp3")
        _ffmpeg(["-i", s, *NORM_ARGS, n])
        norm.append(n)

    silence = None
    if gap > 0:
        silence = os.path.join(tmpdir, "gap.mp3")
        _ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", str(gap), *NORM_ARGS, silence])
        gap_dur = duration(silence)
    else:
        gap_dur = 0.0

    starts = []
    t = 0.0
    list_file = os.path.join(tmpdir, "concat.txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for i, n in enumerate(norm):
            starts.append(round(t, 3))
            f.write(f"file '{n}'\n")
            t += duration(n)
            if silence and i < len(norm) - 1:
                f.write(f"file '{silence}'\n")
                t += gap_dur
    _ffmpeg(["-f", "concat", "-safe", "0", "-i", list_file, "-c", "copy", out_path])
    return starts, round(t, 3)
