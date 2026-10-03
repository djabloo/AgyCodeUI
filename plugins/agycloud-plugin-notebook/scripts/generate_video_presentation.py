#!/usr/bin/env python3
"""
Video narrato per AgyCloud Notebook Studio.

Input: JSON scritto da agy con le slide e il parlato di ciascuna.
Output: un unico file HTML autonomo che si comporta come un video: le slide
avanzano da sole in sincrono con la voce narrante (Edge o ElevenLabs, vedi
tts_engine.py), con play/pausa, barra di avanzamento, sottotitoli e schermo intero.

Le slide sono disegnate da un template fisso (non HTML scritto dal modello):
la sincronizzazione con l'audio resta affidabile e il testo delle fonti non
puo' iniettare markup, perche' viene inserito con textContent.

Uso: python3 generate_video_presentation.py <slides.json> <output.html>
"""

import asyncio
import base64
import json
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tts_engine

LAYOUTS = {"cover", "bullets", "kpis", "steps", "quote", "closing"}


def clean_narration(text):
    t = re.sub(r"[*_#`~]", "", text or "")
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    return t.strip()


def normalize(data):
    slides = []
    for s in data.get("slides") or []:
        if not isinstance(s, dict):
            continue
        narration = clean_narration(s.get("narration") or s.get("notes") or "")
        if not narration:
            # Una slide muta romperebbe il ritmo: si legge almeno il titolo.
            narration = clean_narration(s.get("title") or "")
        if not narration:
            continue
        layout = (s.get("layout") or "bullets").strip().lower()
        if layout not in LAYOUTS:
            layout = "bullets"
        str_list = lambda v: [str(x) for x in (v or []) if isinstance(x, (str, int, float)) and str(x).strip()][:6]
        kpis = []
        for k in (s.get("kpis") or [])[:4]:
            if isinstance(k, dict) and (k.get("value") or k.get("label")):
                kpis.append({"value": str(k.get("value", "")), "label": str(k.get("label", ""))})
        slides.append({
            "layout": layout,
            "title": str(s.get("title") or ""),
            "subtitle": str(s.get("subtitle") or ""),
            "bullets": str_list(s.get("bullets")),
            "steps": str_list(s.get("steps")),
            "kpis": kpis,
            "quote": str(s.get("quote") or ""),
            "narration": narration,
        })
    return slides


async def build(json_path, out_path):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    title = str(data.get("title") or "Video narrato")
    subtitle = str(data.get("subtitle") or "")
    slides = normalize(data)
    if not slides:
        raise ValueError("Nessuna slide con parlato nel JSON")

    print(f"🎬 Video narrato ({tts_engine.provider_label()}): {len(slides)} slide")

    with tempfile.TemporaryDirectory() as tmpdir:
        items = [{"text": s["narration"], "slot": "A", "out": os.path.join(tmpdir, f"slide_{i:03d}.mp3")}
                 for i, s in enumerate(slides)]
        await tts_engine.synthesize_all(items)
        final_mp3 = os.path.join(tmpdir, "narrazione.mp3")
        # Pausa piu' lunga che nel podcast: lascia respirare il cambio slide.
        starts, total = tts_engine.concat([it["out"] for it in items], final_mp3, tmpdir, gap=0.8)
        with open(final_mp3, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode("ascii")

    for s, t in zip(slides, starts):
        s["start"] = t

    payload = {
        "title": title,
        "subtitle": subtitle,
        "voices": tts_engine.provider_label(),
        "total": total,
        "slides": slides,
    }
    # JSON dentro <script>: niente "</" che chiuderebbe il tag.
    data_js = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40] or "video"
    html_title = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    html = (TEMPLATE
            .replace("__HTML_TITLE__", html_title)
            .replace("__DATA__", data_js)
            .replace("__MP3_NAME__", f"narrazione-{slug}.mp3")
            .replace("__AUDIO__", audio_b64))

    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ Video narrato generato: {out_path} ({total:.0f}s)")


TEMPLATE = r"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>__HTML_TITLE__ — Video narrato</title>
<style>
  :root { --bg:#05070b; --stage:#0d1219; --card:rgba(255,255,255,.04); --line:rgba(255,255,255,.09);
          --cyan:#22d3ee; --amber:#fbbf24; --violet:#a78bfa; --text:#f1f5f9; --muted:#94a3b8; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { height:100%; background:var(--bg); color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; overflow:hidden; }
  .wrap { height:100%; display:flex; flex-direction:column; }
  .viewport { flex:1; display:flex; align-items:center; justify-content:center; position:relative; min-height:0; }
  .stage { width:1280px; height:720px; position:absolute; left:50%; top:50%; transform-origin:center center;
    background:radial-gradient(1200px 600px at 85% -10%, rgba(34,211,238,.10), transparent 60%),
               radial-gradient(900px 500px at -10% 110%, rgba(167,139,250,.10), transparent 60%), var(--stage);
    border-radius:14px; overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,.6); }
  .slide { position:absolute; inset:0; padding:72px 88px; display:flex; flex-direction:column; justify-content:center;
    opacity:0; transform:translateY(14px); transition:opacity .6s ease, transform .6s ease; pointer-events:none; }
  .slide.on { opacity:1; transform:none; }
  .kicker { font-size:15px; letter-spacing:.18em; text-transform:uppercase; color:var(--cyan); font-weight:700; margin-bottom:18px; }
  h1 { font-size:64px; line-height:1.08; font-weight:800; letter-spacing:-.02em; max-width:1000px; }
  h2 { font-size:44px; line-height:1.12; font-weight:800; letter-spacing:-.01em; margin-bottom:34px; max-width:1050px; }
  .sub { font-size:24px; color:var(--muted); margin-top:22px; max-width:900px; line-height:1.4; }
  .accent { width:84px; height:5px; border-radius:3px; background:linear-gradient(90deg,var(--cyan),var(--violet)); margin:26px 0 0; }
  .rev { opacity:0; transform:translateY(10px); transition:opacity .5s ease, transform .5s ease; }
  .rev.in { opacity:1; transform:none; }
  ul.bul { list-style:none; display:flex; flex-direction:column; gap:18px; }
  ul.bul li { font-size:27px; line-height:1.35; padding-left:38px; position:relative; color:#e2e8f0; max-width:1050px; }
  ul.bul li::before { content:''; position:absolute; left:4px; top:13px; width:14px; height:14px; border-radius:4px;
    background:linear-gradient(135deg,var(--cyan),var(--violet)); }
  .kpis { display:grid; gap:22px; }
  .kpi { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:30px 26px; }
  .kpi .v { font-size:52px; font-weight:800; background:linear-gradient(90deg,var(--cyan),var(--amber));
    -webkit-background-clip:text; background-clip:text; color:transparent; line-height:1.1; }
  .kpi .l { font-size:19px; color:var(--muted); margin-top:10px; line-height:1.35; }
  .steps { display:flex; gap:18px; align-items:stretch; }
  .step { flex:1; background:var(--card); border:1px solid var(--line); border-radius:18px; padding:26px 22px; position:relative; }
  .step .n { width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center;
    font-weight:800; font-size:19px; color:#05070b; background:linear-gradient(135deg,var(--cyan),var(--violet)); margin-bottom:16px; }
  .step .t { font-size:21px; line-height:1.35; color:#e2e8f0; }
  .quote { font-size:42px; line-height:1.3; font-weight:700; max-width:1050px; position:relative; padding-left:40px;
    border-left:6px solid var(--amber); }
  .caption { position:absolute; left:50%; bottom:28px; transform:translateX(-50%); max-width:1080px; width:max-content;
    background:rgba(0,0,0,.72); color:#fff; font-size:21px; line-height:1.4; padding:10px 18px; border-radius:10px;
    text-align:center; display:none; }
  .caption.on { display:block; }
  .brand { position:absolute; right:30px; top:24px; font-size:13px; color:var(--muted); letter-spacing:.08em; }
  .num { position:absolute; left:88px; bottom:30px; font-size:14px; color:var(--muted); font-family:ui-monospace,monospace; }
  .big-play { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(5,7,11,.35);
    cursor:pointer; z-index:5; }
  .big-play div { width:110px; height:110px; border-radius:50%; background:linear-gradient(135deg,var(--cyan),#0284c7);
    display:flex; align-items:center; justify-content:center; box-shadow:0 10px 40px rgba(34,211,238,.45); }
  .big-play.hide { display:none; }
  .bar { display:flex; align-items:center; gap:12px; padding:10px 16px; background:#0a0e14; border-top:1px solid var(--line); }
  .bar button, .bar a { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); color:#fff; border-radius:8px;
    height:34px; min-width:34px; padding:0 10px; display:inline-flex; align-items:center; justify-content:center; gap:6px;
    cursor:pointer; font-size:13px; font-weight:600; text-decoration:none; }
  .bar button:hover, .bar a:hover { background:rgba(255,255,255,.15); }
  .bar button.on { border-color:var(--cyan); color:var(--cyan); }
  .time { font-family:ui-monospace,monospace; font-size:12.5px; color:var(--muted); min-width:92px; text-align:center; }
  .prog { flex:1; height:8px; background:rgba(255,255,255,.12); border-radius:4px; position:relative; cursor:pointer; }
  .prog .fill { position:absolute; left:0; top:0; bottom:0; width:0; border-radius:4px; background:linear-gradient(90deg,var(--cyan),var(--violet)); }
  .prog .tick { position:absolute; top:-3px; width:2px; height:14px; background:rgba(255,255,255,.35); border-radius:1px; }
  .voices { font-size:11.5px; color:var(--muted); white-space:nowrap; }
  :fullscreen .bar { position:fixed; left:0; right:0; bottom:0; opacity:0; transition:opacity .3s; }
  :fullscreen .bar:hover, :fullscreen.show-bar .bar { opacity:1; }
  @media (max-width:640px) { .voices { display:none; } .bar { gap:6px; padding:8px; } }
</style>
</head>
<body>
<div class="wrap" id="wrap">
  <div class="viewport" id="viewport">
    <div class="stage" id="stage">
      <div id="slides"></div>
      <div class="caption" id="caption"></div>
      <div class="brand">AgyCloud Notebook</div>
      <div class="num" id="num"></div>
      <div class="big-play" id="bigplay" title="Avvia"><div>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="#fff"><polygon points="7 4 20 12 7 20 7 4"></polygon></svg>
      </div></div>
    </div>
  </div>
  <div class="bar">
    <button id="prev" title="Slide precedente (←)">&#9664;&#9664;</button>
    <button id="play" title="Play / Pausa (spazio)">&#9654;</button>
    <button id="next" title="Slide successiva (→)">&#9654;&#9654;</button>
    <span class="time" id="time">0:00 / 0:00</span>
    <div class="prog" id="prog"><div class="fill" id="fill"></div></div>
    <button id="cc" title="Sottotitoli (C)">CC</button>
    <button id="speed" title="Velocità">1x</button>
    <a id="dl" download="__MP3_NAME__" title="Scarica la narrazione MP3">MP3</a>
    <button id="fs" title="Schermo intero (F)">&#x26F6;</button>
    <span class="voices" id="voices"></span>
  </div>
</div>
<audio id="audio" preload="auto" src="data:audio/mpeg;base64,__AUDIO__"></audio>
<script id="data" type="application/json">__DATA__</script>
<script>
(function () {
  const D = JSON.parse(document.getElementById('data').textContent);
  const S = D.slides;
  const audio = document.getElementById('audio');
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  $('dl').href = audio.src;
  $('voices').textContent = 'Voci: ' + D.voices;

  // ── disegno delle slide (solo textContent: nessun markup dalle fonti) ──
  const slideEls = S.map((s, i) => {
    const sl = el('section', 'slide');
    const reveal = [];
    if (s.layout === 'cover') {
      sl.appendChild(el('div', 'kicker', D.subtitle ? 'Video narrato' : 'AgyCloud Notebook'));
      sl.appendChild(el('h1', null, s.title || D.title));
      if (s.subtitle || D.subtitle) sl.appendChild(el('div', 'sub', s.subtitle || D.subtitle));
      sl.appendChild(el('div', 'accent'));
    } else if (s.layout === 'quote') {
      if (s.title) sl.appendChild(el('div', 'kicker', s.title));
      sl.appendChild(el('div', 'quote', s.quote || (s.bullets[0] || s.subtitle)));
      if (s.subtitle && s.quote) sl.appendChild(el('div', 'sub', s.subtitle));
    } else {
      if (s.layout === 'closing') sl.appendChild(el('div', 'kicker', 'In sintesi'));
      sl.appendChild(el('h2', null, s.title));
      if (s.layout === 'kpis' && s.kpis.length) {
        const g = el('div', 'kpis'); g.style.gridTemplateColumns = 'repeat(' + s.kpis.length + ', 1fr)';
        s.kpis.forEach((k) => { const c = el('div', 'kpi rev'); c.appendChild(el('div', 'v', k.value)); c.appendChild(el('div', 'l', k.label)); g.appendChild(c); reveal.push(c); });
        sl.appendChild(g);
      } else if (s.layout === 'steps' && s.steps.length) {
        const g = el('div', 'steps');
        s.steps.forEach((t, n) => { const c = el('div', 'step rev'); c.appendChild(el('div', 'n', String(n + 1))); c.appendChild(el('div', 't', t)); g.appendChild(c); reveal.push(c); });
        sl.appendChild(g);
      } else {
        const items = s.bullets.length ? s.bullets : (s.steps.length ? s.steps : []);
        if (items.length) {
          const ul = el('ul', 'bul');
          items.forEach((t) => { const li = el('li', 'rev', t); ul.appendChild(li); reveal.push(li); });
          sl.appendChild(ul);
        }
        if (s.subtitle) sl.appendChild(el('div', 'sub', s.subtitle));
      }
    }
    $('slides').appendChild(sl);
    return { el: sl, reveal };
  });

  // ── adattamento 16:9 alla finestra ──
  function fit() {
    const vp = $('viewport').getBoundingClientRect();
    const k = Math.min(vp.width / 1280, vp.height / 720) * 0.98;
    $('stage').style.transform = 'translate(-50%, -50%) scale(' + k + ')';
  }
  window.addEventListener('resize', fit); fit();

  // ── barra: tacche di inizio slide ──
  function total() { return audio.duration && isFinite(audio.duration) ? audio.duration : D.total; }
  function drawTicks() {
    document.querySelectorAll('.tick').forEach((t) => t.remove());
    S.forEach((s, i) => { if (!i) return; const t = el('div', 'tick'); t.style.left = (s.start / total() * 100) + '%'; $('prog').appendChild(t); });
  }
  drawTicks();
  audio.addEventListener('loadedmetadata', drawTicks);

  const fmt = (x) => { x = Math.max(0, x || 0); const m = Math.floor(x / 60), s = Math.floor(x % 60); return m + ':' + (s < 10 ? '0' : '') + s; };
  function slideAt(t) { let idx = 0; for (let i = 0; i < S.length; i++) { if (t + 0.05 >= S[i].start) idx = i; else break; } return idx; }
  function slideEnd(i) { return i + 1 < S.length ? S[i + 1].start : total(); }

  let current = -1;
  function render() {
    const t = audio.currentTime;
    const idx = slideAt(t);
    if (idx !== current) {
      slideEls.forEach((s, i) => s.el.classList.toggle('on', i === idx));
      $('caption').textContent = S[idx].narration;
      $('num').textContent = (idx + 1) + ' / ' + S.length;
      current = idx;
    }
    // Gli elementi della slide compaiono man mano che la voce procede.
    const rv = slideEls[idx].reveal;
    if (rv.length) {
      const span = Math.max(0.1, slideEnd(idx) - S[idx].start);
      const frac = (t - S[idx].start) / span;
      rv.forEach((r, n) => r.classList.toggle('in', frac >= (n / rv.length) * 0.8 - 0.02));
    }
    $('fill').style.width = (t / total() * 100) + '%';
    $('time').textContent = fmt(t) + ' / ' + fmt(total());
  }
  audio.addEventListener('timeupdate', render);
  render();
  // Copertina subito leggibile anche prima del play.
  slideEls[0].reveal.forEach((r) => r.classList.add('in'));

  function toggle() { if (audio.paused) audio.play(); else audio.pause(); }
  function go(i) { i = Math.max(0, Math.min(S.length - 1, i)); audio.currentTime = S[i].start + 0.01; render(); }
  audio.addEventListener('play', () => { $('play').innerHTML = '&#10074;&#10074;'; $('bigplay').classList.add('hide'); });
  audio.addEventListener('pause', () => { $('play').innerHTML = '&#9654;'; });
  audio.addEventListener('ended', () => { $('play').innerHTML = '&#8635;'; });

  $('bigplay').onclick = () => audio.play();
  $('play').onclick = toggle;
  $('prev').onclick = () => { const i = slideAt(audio.currentTime); go(audio.currentTime - S[i].start > 1.5 ? i : i - 1); };
  $('next').onclick = () => go(slideAt(audio.currentTime) + 1);
  $('prog').onclick = (e) => { const r = $('prog').getBoundingClientRect(); audio.currentTime = (e.clientX - r.left) / r.width * total(); render(); };
  $('cc').onclick = () => { $('caption').classList.toggle('on'); $('cc').classList.toggle('on'); };
  const speeds = [1, 1.25, 1.5, 0.85]; let sp = 0;
  $('speed').onclick = () => { sp = (sp + 1) % speeds.length; audio.playbackRate = speeds[sp]; $('speed').textContent = speeds[sp] + 'x'; };
  function fs() { if (document.fullscreenElement) document.exitFullscreen(); else if ($('wrap').requestFullscreen) $('wrap').requestFullscreen().catch(() => {}); }
  $('fs').onclick = fs;
  document.addEventListener('fullscreenchange', () => setTimeout(fit, 50));
  let hideT = null;
  document.addEventListener('mousemove', () => { $('wrap').classList.add('show-bar'); clearTimeout(hideT); hideT = setTimeout(() => $('wrap').classList.remove('show-bar'), 2200); });
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight') go(slideAt(audio.currentTime) + 1);
    else if (e.key === 'ArrowLeft') go(slideAt(audio.currentTime) - 1);
    else if (e.key === 'f' || e.key === 'F') fs();
    else if (e.key === 'c' || e.key === 'C') $('cc').click();
  });
})();
</script>
</body>
</html>
"""


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python3 generate_video_presentation.py <slides.json> <output.html>")
        sys.exit(1)
    try:
        asyncio.run(build(sys.argv[1], sys.argv[2]))
    except tts_engine.TTSError as e:
        print(str(e), file=sys.stderr)
        sys.exit(2)
