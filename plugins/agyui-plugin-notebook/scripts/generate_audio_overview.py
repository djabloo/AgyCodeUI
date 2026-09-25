#!/usr/bin/env python3
"""
Audio Overview Generator for AGYUI Notebook Studio
Generates a multi-voice deep-dive podcast (Diego & Elsa) from structured dialogue JSON
using edge-tts and ffmpeg, packaging it into a standalone interactive HTML5 player.
"""

import sys
import os
import json
import asyncio
import tempfile
import subprocess
import base64

VOICES = {
    "Diego": "it-IT-DiegoNeural",
    "Elsa": "it-IT-ElsaNeural"
}

def resolve_voice_and_speaker(speaker_raw):
    s = (speaker_raw or "").strip().lower()
    if "elsa" in s or "host 2" in s or "donna" in s or "female" in s:
        return "it-IT-ElsaNeural", "Elsa", "elsa", "E"
    return "it-IT-DiegoNeural", "Diego", "diego", "D"

def clean_text_for_speech(text):
    if not text:
        return "..."
    import re
    # Rimuovi prefissi come "Diego:" o "**Elsa:**" se l'LLM li ha inclusi nel testo
    t = re.sub(r'^(?:Diego|Elsa|Host\s*\d?)\s*:\s*', '', text, flags=re.IGNORECASE)
    # Rimuovi markdown asterischi, cancelletti, link
    t = re.sub(r'[*_#`~]', '', t)
    t = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', t)
    return t.strip() or "..."


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — Overview Audio</title>
  <style>
    :root {{
      --bg: #07090e;
      --card-bg: rgba(18, 24, 38, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent-cyan: #06b6d4;
      --accent-purple: #a855f7;
      --diego-color: #38bdf8;
      --elsa-color: #e879f9;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      padding: 24px 20px;
      line-height: 1.6;
    }}
    .container {{
      max-width: 820px;
      margin: 0 auto;
    }}
    /* Header Card */
    .header-card {{
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%), var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 28px;
      backdrop-filter: blur(12px);
      margin-bottom: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }}
    .badge {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent-cyan);
      border: 1px solid rgba(6, 182, 212, 0.3);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }}
    h1 {{
      font-size: 1.7rem;
      font-weight: 800;
      color: #fff;
      margin-bottom: 8px;
      line-height: 1.25;
    }}
    .subtitle {{
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-bottom: 20px;
    }}
    /* Audio Player Custom */
    .player-box {{
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px 20px;
      margin-top: 14px;
    }}
    .player-controls {{
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 12px;
    }}
    .btn-play {{
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-cyan), #0284c7);
      border: none;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(6, 182, 212, 0.4);
      transition: transform 0.15s, box-shadow 0.15s;
    }}
    .btn-play:hover {{ transform: scale(1.05); box-shadow: 0 6px 20px rgba(6, 182, 212, 0.6); }}
    .time-info {{
      font-family: ui-monospace, monospace;
      font-size: 0.82rem;
      color: var(--text-muted);
      min-width: 85px;
    }}
    .progress-bar-wrap {{
      flex: 1;
      height: 6px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 3px;
      cursor: pointer;
      position: relative;
    }}
    .progress-bar-fill {{
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple));
      border-radius: 3px;
    }}
    .speed-btn {{
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }}
    .speed-btn:hover {{ background: rgba(255, 255, 255, 0.18); }}
    .download-btn {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: 1px solid var(--card-border);
      color: var(--accent-cyan);
      text-decoration: none;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 8px;
      margin-left: auto;
      transition: border-color 0.2s, background 0.2s;
    }}
    .download-btn:hover {{ background: rgba(6, 182, 212, 0.1); border-color: var(--accent-cyan); }}

    /* Takeaways Section */
    .takeaways-card {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 22px;
      margin-bottom: 24px;
    }}
    .takeaways-title {{
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .takeaways-list {{
      list-style: none;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }}
    @media (max-width: 650px) {{
      .takeaways-list {{ grid-template-columns: 1fr; }}
    }}
    .takeaways-list li {{
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 0.85rem;
      color: #cbd5e1;
      display: flex;
      gap: 8px;
    }}
    .takeaways-list li span.dot {{
      color: var(--accent-cyan);
      font-weight: bold;
    }}

    /* Transcript Conversation */
    .transcript-card {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 22px;
    }}
    .transcript-header {{
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 12px;
    }}
    .dialogue-item {{
      display: flex;
      gap: 14px;
      margin-bottom: 16px;
      padding: 12px 14px;
      border-radius: 12px;
      transition: background 0.2s;
    }}
    .dialogue-item:hover {{ background: rgba(255, 255, 255, 0.03); }}
    .dialogue-item.active {{ background: rgba(6, 182, 212, 0.1); border-left: 3px solid var(--accent-cyan); }}
    .avatar {{
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.85rem;
      flex-shrink: 0;
    }}
    .avatar.diego {{
      background: rgba(56, 189, 248, 0.15);
      color: var(--diego-color);
      border: 1px solid rgba(56, 189, 248, 0.4);
    }}
    .avatar.elsa {{
      background: rgba(232, 121, 249, 0.15);
      color: var(--elsa-color);
      border: 1px solid rgba(232, 121, 249, 0.4);
    }}
    .msg-body {{ flex: 1; }}
    .speaker-name {{
      font-size: 0.8rem;
      font-weight: 700;
      margin-bottom: 4px;
    }}
    .speaker-name.diego {{ color: var(--diego-color); }}
    .speaker-name.elsa {{ color: var(--elsa-color); }}
    .msg-text {{
      font-size: 0.9rem;
      color: #e2e8f0;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header-card">
      <div class="badge">🎙️ Overview Audio • NotebookLM Style</div>
      <h1>{title}</h1>
      <p class="subtitle">{subtitle}</p>

      <div class="player-box">
        <audio id="podcast-audio" src="data:audio/mp3;base64,{audio_base64}"></audio>
        <div class="player-controls">
          <button class="btn-play" id="play-btn" title="Riproduci / Pausa">
            <svg id="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <svg id="pause-icon" style="display:none;" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          </button>
          <div class="time-info"><span id="curr-time">0:00</span> / <span id="dur-time">0:00</span></div>
          <div class="progress-bar-wrap" id="prog-wrap">
            <div class="progress-bar-fill" id="prog-fill"></div>
          </div>
          <button class="speed-btn" id="speed-btn">1.0x</button>
          <a class="download-btn" id="dl-link" href="data:audio/mp3;base64,{audio_base64}" download="{filename_mp3}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Scarica MP3
          </a>
        </div>
      </div>
    </div>

    <div class="takeaways-card">
      <div class="takeaways-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        Punti Chiave della Discussione
      </div>
      <ul class="takeaways-list">
        {takeaways_html}
      </ul>
    </div>

    <div class="transcript-card">
      <div class="transcript-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        Trascrizione Dialogo Podcast
      </div>
      <div class="dialogue-flow">
        {dialogue_html}
      </div>
    </div>
  </div>

  <script>
    const audio = document.getElementById('podcast-audio');
    const playBtn = document.getElementById('play-btn');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const currTime = document.getElementById('curr-time');
    const durTime = document.getElementById('dur-time');
    const progWrap = document.getElementById('prog-wrap');
    const progFill = document.getElementById('prog-fill');
    const speedBtn = document.getElementById('speed-btn');

    function fmtTime(s) {{
      if (isNaN(s)) return "0:00";
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return m + ":" + (sec < 10 ? "0" : "") + sec;
    }}

    playBtn.onclick = () => {{
      if (audio.paused) {{ audio.play(); }} else {{ audio.pause(); }}
    }};

    audio.onplay = () => {{
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    }};

    audio.onpause = () => {{
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    }};

    audio.onloadedmetadata = () => {{
      durTime.textContent = fmtTime(audio.duration);
    }};

    audio.ontimeupdate = () => {{
      currTime.textContent = fmtTime(audio.currentTime);
      if (audio.duration) {{
        const p = (audio.currentTime / audio.duration) * 100;
        progFill.style.width = p + "%";
      }}
    }};

    progWrap.onclick = (e) => {{
      const rect = progWrap.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      audio.currentTime = pos * audio.duration;
    }};

    const speeds = [1.0, 1.25, 1.5, 1.75, 2.0];
    let curSpeedIdx = 0;
    speedBtn.onclick = () => {{
      curSpeedIdx = (curSpeedIdx + 1) % speeds.length;
      const s = speeds[curSpeedIdx];
      audio.playbackRate = s;
      speedBtn.textContent = s + "x";
    }};
  </script>
</body>
</html>
"""

async def synthesize_turn(text, voice, out_path):
    import edge_tts
    comm = edge_tts.Communicate(text, voice)
    await comm.save(out_path)

async def generate_podcast(dialogue_json_path, output_html_path):
    with open(dialogue_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    title = data.get("title", "Overview Audio")
    subtitle = data.get("subtitle", "Discussione approfondita delle fonti caricate")
    takeaways = data.get("takeaways", [])
    dialogue = data.get("dialogue", [])

    if not dialogue:
        raise ValueError("Nessuna battuta trovata nel file dialogue.json")

    print(f"🎙️ Generazione podcast in parallelo: {len(dialogue)} scambi tra Diego ed Elsa...")

    with tempfile.TemporaryDirectory() as tmpdir:
        segment_files = [os.path.join(tmpdir, f"seg_{i:03d}.mp3") for i in range(len(dialogue))]
        tasks = []
        for i, turn in enumerate(dialogue):
            spk_raw = turn.get("speaker", "Diego")
            text_raw = turn.get("text", "")
            voice, _, _, _ = resolve_voice_and_speaker(spk_raw)
            text_clean = clean_text_for_speech(text_raw)
            tasks.append(synthesize_turn(text_clean, voice, segment_files[i]))

        await asyncio.gather(*tasks)
        print("  ✓ Tutte le tracce vocali sintetizzate.")

        list_file = os.path.join(tmpdir, "concat.txt")
        with open(list_file, "w", encoding="utf-8") as f:
            for s in segment_files:
                f.write(f"file '{s}'\n")

        final_mp3 = os.path.join(tmpdir, "podcast_final.mp3")
        subprocess.run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", list_file, "-c", "copy", final_mp3
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        with open(final_mp3, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode("utf-8")

    # Costruisci HTML
    takeaways_html = "".join([f'<li><span class="dot">•</span> {t}</li>' for t in takeaways])
    
    dialogue_html = []
    for turn in dialogue:
        spk_raw = turn.get("speaker", "Diego")
        voice, spk, cls, init = resolve_voice_and_speaker(spk_raw)
        txt = turn.get("text", "")
        dialogue_html.append(f"""
          <div class="dialogue-item">
            <div class="avatar {cls}">{init}</div>
            <div class="msg-body">
              <div class="speaker-name {cls}">{spk}</div>
              <div class="msg-text">{txt}</div>
            </div>
          </div>
        """)
    
    filename_mp3 = f"podcast-{title.lower().replace(' ', '_')[:24]}.mp3"

    html_content = HTML_TEMPLATE.format(
        title=title,
        subtitle=subtitle,
        audio_base64=audio_b64,
        filename_mp3=filename_mp3,
        takeaways_html=takeaways_html,
        dialogue_html="".join(dialogue_html)
    )

    out_dir = os.path.dirname(os.path.abspath(output_html_path))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"✅ Overview Audio generato con successo in: {output_html_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python3 generate_audio_overview.py <dialogue.json> <output.html>")
        sys.exit(1)

    asyncio.run(generate_podcast(sys.argv[1], sys.argv[2]))
