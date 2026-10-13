# stt-bench — self-hosted STT benchmark for ClassPulse

> Copy of `X:\Projects\stt-bench\README.md`. The benchmark scripts, data and models live in that folder on the owner's machine (outside this repository); the results are in [stt-benchmark-2026-10-12.md](stt-benchmark-2026-10-12.md).


Benchmarks open speech-to-text models against Sarvam `saaras:v3` (production) and OpenAI `whisper-1`
on FLEURS (9 Indic languages + English), NPTEL Indian-English lecture speech and real ClassPulse
classroom recordings (Tamil–English code-mix). Results and analysis: `REPORT.md`.

## Layout

```
scripts/            all code (the only place code is run from)
  common.py         paths, cache env vars (everything on X:), normaliser, metrics, results I/O, resource monitor
  build_fleurs.py   FLEURS test parquet -> 25 seeded utterances/lang (seed 20261012) -> data/fleurs/<lang>/*.wav
  build_nptel.py    NPTEL2020 Indian English (3 remote row groups, 25 utts, <=2 per speaker) -> data/nptel/en
  build_lectures.py 4 local recordings in audio/ -> 10 x 60 s windows (data/lectures/win) + 30 s pieces for Sarvam
  run_api.py        sarvam | openai  (keys read in-memory from ClassPulse apps/api/.env; 90-min cap per provider)
  run_local.py      one local model per process (faster-whisper, transformers whisper/MMS/omniASR/Qwen3-ASR/NVIDIA)
  run_nemo.py       AI4Bharat IndicConformer 600M multilingual via the AI4Bharat NeMo fork (venv-nemo)
  queue.sh          runs several run_local.py models strictly one after another
  predownload.py    pre-fetches HF weights so measured load times are disk loads
  cpu_rtf.py        IndicConformer CPU-only speed probe (venv-nemo)
  llm_correct.py    LLM post-correction (openai gpt-4.1-mini | local llama.cpp server), segment-preserving JSON, guarded
  llm_guard.py      guards: phonetic edit distance <=35%, length ratio 0.7-1.4, no romanised native words
  reguard.py        re-apply guards to stored LLM outputs without new LLM calls
  make_llm_tables.py -> results/llm_tables.md
  evaluate.py       -> results/summary.csv, results/lecture_summary.csv
  make_tables.py    -> results/tables.md (markdown tables)
  make_report.py    -> REPORT.md (narrative in report_text.py + results/tables.md)
data/               audio + manifest.jsonl (data/raw = downloaded FLEURS parquet, 5.6 GB, untrusted, never executed; safe to delete)
models/             model weights (HF cache in models/hub, CTranslate2 in models/ct2, .nemo, IndicWhisper)
results/            <model>.jsonl (one line per utterance), meta/<model>.json (load time, VRAM, RAM), CSVs
logs/               run logs
venv/               main env (torch 2.11 cu128, transformers 5.19, faster-whisper 1.2.1 / CTranslate2 4.8.2)
venv-nemo/          NeMo env (AI4Bharat NeMo fork nemo-v2 installed --no-deps without triton, transformers 4.41)
```

## Re-running (e.g. on a bigger GPU)

```bash
python -m venv venv && venv/Scripts/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
venv/Scripts/pip install transformers huggingface_hub pyarrow pandas soundfile librosa imageio-ffmpeg jiwer \
    indic-nlp-library faster-whisper requests psutil numpy python-dotenv accelerate sentencepiece indic-transliteration
cd scripts
python build_fleurs.py 25 && python build_nptel.py && python build_lectures.py
cat ../data/fleurs/*/manifest.jsonl ../data/nptel/en/manifest.jsonl ../data/lectures/manifest.jsonl > ../data/manifest.jsonl
python run_api.py sarvam && python run_api.py openai          # needs the .env path in run_api.py
bash queue.sh fw-large-v3 "fw-large-v3-auto|--sets lecture" mms-1b-all omniasr-ctc-1b-v2 ...
../venv-nemo/Scripts/python run_nemo.py rnnt && ../venv-nemo/Scripts/python run_nemo.py ctc
../venv-nemo/Scripts/python run_nemo.py rnnt --sets lecture --chunk 20   # chunked long-form variant
# LLM phase: tools/llama.cpp/llama-server.exe -m ../../models/gguf/Qwen3-8B-Q4_K_M.gguf -ngl 99 -c 8192 -fa on --port 8088 --jinja
python llm_correct.py openai indicconformer-600m-rnnt fleurs
python llm_correct.py openai indicconformer-600m-rnnt-chunk20s lecture
python llm_correct.py local  indicconformer-600m-rnnt fleurs --model qwen3-8b-q4km      # etc.
python evaluate.py && python make_tables.py && python make_llm_tables.py && python make_report.py
```

On Linux, install the AI4Bharat NeMo fork normally (`git clone -b nemo-v2 https://github.com/AI4Bharat/NeMo && bash reinstall.sh`).
To scale up: raise `N` in build_fleurs.py, increase the lecture windows in build_lectures.py, and add model keys in
`REG` in run_local.py. Results files are append-only and resumable (already-done ids are skipped; errored ids are retried).

Model keys available: see `REG` in `scripts/run_local.py`.
