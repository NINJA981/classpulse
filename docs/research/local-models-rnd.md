# Local (self-hosted) AI models for ClassPulse: R&D report and benchmark plan

**Date:** 11 October 2026 · **Status:** research only (no experiments run) · **Audience:** owner and engineering

**How to read this:**
- Section 1 is the one-page summary.
- Sections 3–6 give the evidence.
- Section 7 is the benchmark plan for when GPUs arrive.
- Section 8 lists the code changes.
- Section 10 lists every source.
- Section 11 is the fully local roadmap for **every** AI feature, including the teacher tools shipped after the first draft (added 2026-10-11).

**Labels used throughout:**
- **(calc)**: a number I worked out myself, for example GPU memory from parameter count. It was not published by the vendor.
- **(est.)**: a rough estimate that must be measured.
- **UNVERIFIED**: not confirmed against a primary source.

Prices were seen on 2026-10-11 and are approximate. INR to USD uses about ₹88 = $1, which is an assumption.

---

## 1. Executive summary

**The question.** Can ClassPulse replace its paid AI services with open models running on its own GPU? Today it pays Sarvam for speech-to-text (Saaras v3 in codemix mode) and OpenAI for quizzes, summaries, assignments and grading (gpt-4.1-mini).

**Short answer: probably yes for speech-to-text, likely yes for quiz writing, and not yet for handwriting grading.** It is only worth doing if a benchmark on our own classroom recordings confirms it. The main reasons to do it are **privacy and control** (lecture audio never leaves our servers). Cost is a secondary reason: at pilot scale the APIs are cheaper than renting a GPU.

**What changed in 2026 that makes this realistic:**

1. **Open speech-to-text models for Indian languages caught up with Sarvam (on paper).**
   - Bodhan AI and AI4Bharat (IIT Madras, with NVIDIA) released **Indic-Transcribe-core / -flex** in September 2026. They are 1.2B-parameter models covering all our 11 languages including Indian English.
   - On the Voice of India benchmark, the core model card reports an average error score of 8.7, against **10.7 for Saaras v3**.
   - The **flex** model has a "mixed-script" mode that writes English words in Latin letters inside Indic text. That is exactly what our quiz writer needs.
   - Caveats: these are the vendor's own numbers on telephone speech, not classrooms, and the licence needs checking (see the risks below).
2. **Strong open LLMs with real Indian-language ability now ship under permissive licences:**
   - **Sarvam-30B / 105B** (Apache-2.0, March 2026)
   - **Qwen3.5** (Apache-2.0, February 2026)
   - **Gemma 4** (now Apache-2.0, April 2026)
   - **gpt-oss-20b / 120b** (Apache-2.0)
3. **The serving software is mature.** vLLM and SGLang provide an OpenAI-compatible API with JSON-schema-constrained output. ClassPulse already calls OpenAI through a configurable base URL (`OPENAI_BASE_URL`), so a local model can be tested with **almost no code change**.

**Recommended shortlist to benchmark**

| Job | Candidates (in priority order) | Why |
|---|---|---|
| Speech-to-text | 1. `bodhan-ai/indic-transcribe-flex` (mixed-script mode)<br>2. `bodhan-ai/indic-transcribe-core`<br>3. `ai4bharat/indic-conformer-600m-multilingual`<br>4. `ARTPARK-IISc/SraVaani-1.0`<br>Baseline: `faster-whisper` large-v3 / large-v3-turbo | 1–2: best published Indic accuracy, all 11 languages, code-mix output (flex), about 9 GB of GPU memory.<br>3–4: MIT licence, small, strong on Dravidian languages (SraVaani).<br>Whisper: MIT, best tooling, covers Indian English. |
| Quiz / summary / assignment LLM | 1. **Qwen3.5-27B** (FP8 or 4-bit)<br>2. **Sarvam-30B** (MoE, 2.4B active)<br>3. **Gemma 4 31B** (or 26B-A4B)<br>4. **gpt-oss-20b**<br>5. **Qwen3.5-35B-A3B** (speed option)<br>Stretch on an 80 GB GPU: Sarvam-105B or gpt-oss-120b | All Apache-2.0 and fit one 48 GB GPU. Sarvam is India-first, with an efficient Indic tokenizer. Qwen3.5 and Gemma 4 also read images. gpt-oss and the MoE models are fast. |
| Handwriting grading (vision) | 1. **Qwen3.5-27B** (same model as the text job)<br>2. **Gemma 4 31B**<br>Pipeline alternative: `bodhan-ai/indic-doc-parser` (Indic handwriting OCR) followed by a text LLM | No open model has strong *published* Indic handwriting results. We must measure on real student photos. |

**Hardware recommendation**
- Rent **one 48 GB GPU (NVIDIA L40S)** for the benchmark. In India, E2E Networks lists it at about ₹102/hr (~$1.16) excluding GST. This one card runs speech-to-text plus a 27–32B model.
- Add **1 day on an 80 GB H100** (about ₹256/hr at E2E) for the stretch models.
- A 24 GB L4 (about ₹49/hr) is enough for speech-to-text alone, or for a small LLM, but not both at once with long transcripts.

**Cost reality check**
- Today a one-hour lecture costs about **₹30 for Sarvam STT plus about ₹2–4 for the OpenAI quiz** (est.), roughly ₹32–34 per lecture-hour in total. Speech-to-text is about 90% of the bill.
- An always-on L4 (about ₹36k/month) breaks even at **roughly 1,200 lecture-hours/month**. An always-on L40S (about ₹74k/month) needs **roughly 2,300 lecture-hours/month**.
- Below that volume, self-hosting only pays off if the GPU runs **on a schedule** (school hours or overnight batches), or if privacy is worth paying for.

**Main risks**
1. **Licence.** The Bodhan models use a custom "Indic Open Model License". It forbids hosting the model *as an API for others* without written approval, but allows use "solely as an internal component" of our own product. Get written confirmation from Bodhan before production.
2. **Accuracy on real code-mixed classroom audio is unproven.** All published numbers are on other kinds of speech.
3. **Quiz-generation speed.** OpenAI writes 20 questions in about 21 s. A dense 27–32B model on one L40S may take several minutes (est.), while MoE models are much faster.
4. **Operations.** Someone has to run a GPU server. Our current OCI ARM server has no GPU.

**Recommended path**
1. Before the GPUs arrive (about 1 week):
   - write human-checked reference transcripts for our recordings;
   - build the evaluation harness;
   - request licence clarification.
2. With GPUs (2 weeks): run the benchmark in section 7.
3. If the pass thresholds in §7.8 are met, roll out in **hybrid mode**: local model first, automatic fallback to Sarvam/OpenAI on error or failed validation, per-school opt-in.

**Fully local direction** (owner's goal, 2026-10-11: eventually no external AI API; details in §11)
- **Every AI feature has a local candidate, and most share two models.** One speech model (Indic-Transcribe-flex) serves lectures and voice prompts. One ~27B vision-language model (Qwen3.5-27B, or the newer Qwen3.8-27B; both Apache-2.0) serves quizzes, lesson plans, worksheets, question papers, presentations, summaries, remedial plans and grading. Small add-ons cover the gaps: Bodhan IndicOCR for scanned PDFs and handwriting, and bge-m3 embeddings for retrieval.
- **Hardware.** Everything fits on one 48 GB L40S only if the LLM runs at 4-bit (or is the MoE Qwen3.5-35B-A3B), and memory is tight. The comfortable target is **two GPUs**: an L40S or H100 for the LLM, and an L4 for speech, OCR and embeddings.
- **The main new risk is long outputs, not quality.** An 80-mark paper, a bilingual 20-question quiz and a 30+-slide deck already reach our 16,000-token output cap. A dense 27B model writing that much in one stream would take about 5–10 minutes (est.). The plan is to split long jobs into parallel section or slide-batch calls, and to use MoE models for anything a teacher waits on.
- **Structured output carries over.** Our strict `json_schema` requests run on vLLM unchanged. Keep the zod checks and the one repair round, because the grammar engine (XGrammar) is unsound on some schema keywords (we mostly avoid them).
- **Until GPUs arrive, keep gpt-4.1-mini as the default.** A teacher resource costs about ₹1.5–3.5 and a voice prompt about ₹0.5 (est.). Lecture STT is roughly 70% of spend (est.), so it migrates first. Bodhan's licence confirmation now gates STT, OCR and (later) TTS.

---

## 2. Where we are today (baseline to beat)

**Pipeline** (from `docs/HANDBOOK.md` §8 and `apps/api/src/pipeline/`):

| Stage | Today | What a replacement must preserve |
|---|---|---|
| Audio preparation | ffmpeg converts to 16 kHz mono WAV | Same; all candidate models take 16 kHz mono. |
| Speech-to-text | Sarvam `saaras:v3` in **codemix** mode, batch API, phrase timestamps; or OpenAI `whisper-1` with segment timestamps and 10-minute parts | **English technical terms in Latin script** inside Indic text ("JDBC தான்…"); segment timestamps good enough for 15–30 s citations; lectures up to 60+ minutes. |
| Quiz LLM | `gpt-4.1-mini` with `response_format: json_schema, strict: true` | Exactly 4 options and 1 correct answer; explanations; citations to transcript block numbers; difficulty labels with exact counts in "mixed" mode; bilingual fields that keep English terms; summary, takeaways, assignment with rubric; remedial plan. |
| Grading | Same LLM, with photos sent as `image_url` data URIs | Per-criterion marks, feedback and a note; the teacher always reviews. |
| Validation | Per-question validator, duplicate removal, top-up (up to 2 extra requests), one repair request, at least 3 questions | Unchanged. It works for any model and becomes our **benchmark metric**. |

**Measured today (live server, handbook §8.3–8.4):**
- STT on 11 / 22 / 25-minute lectures takes about 15–30 s / 30–50 s / 40–70 s.
- 20 mixed-difficulty questions take about 21 s.

**Current prices** (all approximate; sources in §10):

| Item | Price |
|---|---|
| Sarvam STT (real-time, streaming or batch) | **₹30 per audio-hour** (~$0.34); ₹45/hr with diarization. The pricing page does not name the model. |
| OpenAI Whisper | $0.006/min = $0.36/hr |
| OpenAI gpt-4o-mini-transcribe | ~$0.003/min = $0.18/hr |
| gpt-4.1-mini | $0.40 input / $0.10 cached / $1.60 output per 1M tokens (Batch API half price) |
| gpt-4o-mini | $0.15 / $0.075 / $0.60 |
| gpt-5-mini | $0.25 / $0.025 / $2.00 |
| gpt-4.1 | $2 / $0.50 / $8 |
| gpt-4o | $2.50 / $1.25 / $10 |

**Cost per lecture-hour today (est.):**
- STT: ₹30.
- Quiz LLM: assume one hour of speech is about 60k characters, since the handbook caps transcripts at 150k characters ≈ 2.5 h. That is roughly **15k tokens** (English) to **30k tokens** (Indic script) of input, plus about 8–10k output tokens for 20 bilingual questions, summary and assignment.
- With gpt-4.1-mini that is about **$0.01 input + $0.015 output ≈ $0.03 (₹2–3)**, or ₹3–4 with top-ups and repairs.
- **Total ≈ ₹32–34 per lecture-hour, dominated by STT.**
- Grading and remedial plans add only paise per call (est.).

---

## 3. Speech-to-text (STT) options

### 3.1 Candidate table

Our 11 languages are hi, ta, te, kn, ml, mr, bn, gu, pa, or and en-IN. "OIWER" is the Voice of India error score, which accepts valid spelling and script variants (lower is better). Error rates from different benchmarks **cannot** be compared with each other.

| Model (Hugging Face id) | Released | Size | Our 11 languages | Code-mix (English in Latin script?) | Timestamps | GPU memory / speed | Licence (commercial?) | Best published Indic numbers |
|---|---|---|---|---|---|---|---|---|
| **bodhan-ai/indic-transcribe-flex** | Sep 2026 | 1.2B (Canary-1b-v2-derived FastConformer encoder + Transformer decoder) | **All 11** (27 languages) | **Yes: "mixed-script" mode** writes native words in native script and English words and numerals in Latin, with ITN. Romanized mode also available. | Not documented (UNVERIFIED). Use VAD-chunk times. | 1 h audio in 48 s (77× real time) at **9.2 GiB** (NeMo batched; GPU type not stated). Max 45 s per call; `transcribe_long` splits at pauses into ≤30 s chunks. | Indic Open Model License v1.0, gated. Commercial use allowed; **third-party API hosting needs written approval**; internal-component use is excluded from "hosting" (§3.3). | VoI OIWER avg **11.3** (card) / 11.1 (release blog); hi 4.1, bn 5.0 |
| **bodhan-ai/indic-transcribe-core** | Sep 2026 | 1.2B | **All 11** (25 languages) | Transcribes Hinglish "as spoken", but **native script only**. "JDBC" would come out in Tamil letters, which hurts our quiz writer. | Not documented | Same as flex | Same licence | VoI OIWER avg **8.7**, against Saaras v3 10.7, IndicConformer 17.8, Gemini 3 Pro 21.1, Gemma 3n E4B 36.1, OmniASR-LLM-7B 44.5; hi 3.5 |
| **ai4bharat/indic-conformer-600m-multilingual** | 2024 (UNVERIFIED exact date) | 600M hybrid CTC/RNNT | 10 Indic languages (22 total); **no English** | Not documented; native script | Not documented (CTC allows alignment) | Small; ONNX and quantized variants (could run on CPU, est.) | **MIT**, gated | Vaani hi WER 13.2. SraVaani paper mean WER: hi 13.8, ta 30.1, te 26.4, kn 28.4, ml 28.8, mr 19.4, bn 22.7, gu 19.0, pa 17.3, or 26.4 |
| **ARTPARK-IISc/SraVaani-1.0** (IISc / ARTPARK, Vaani project) | Aug 2026 | ~430M FastConformer TDT-CTC | 65 Indian languages incl. our 10; English WER 14.8 | Not documented | Not documented | ~900 MB FP16; ONNX | **MIT**, gated | Own paper, mean WER: hi 14.0, **ta 26.2**, te 25.1, kn 27.4, ml 27.7, mr 19.7, bn 19.8, gu 19.0, pa 20.2, or 25.7 (Tamil vs IndicConformer 30.1 and Saaras v3 32.1, self-reported) |
| IndicWhisper (AI4Bharat Vistaar) | 2023 | Whisper-medium-based (UNVERIFIED); one model per language | 10 Indic languages, no English | No | Whisper segments | — | **MIT** | Kathbath WER: hi 10.3, ta 24.2, te 25.0, kn 19.3, ml 34.8, mr 19.9, bn 16.6, gu 17.8, pa 16.9, or 24.7. Hindi Vistaar avg 13.6 vs Google 23.9, Azure 20.0 |
| **openai/whisper-large-v3** / **-turbo** (via faster-whisper) | Nov 2023 / Oct 2024 (UNVERIFIED) | 1.55B (UNVERIFIED) / 809M | Nominally all 11; weak on Indic | Tends to stay in one script; hallucinates on silence and long audio (UNVERIFIED this session) | Segment; **word-level** (faster-whisper / WhisperX) | faster-whisper (large-v2, RTX 3070 Ti, 13 min audio): 1m03s fp16 at 4.5 GB; **17 s batched** at 6.1 GB; int8 at 2.9 GB | **MIT** | large-v3: 82.6 WER on IndicVoices-hi (romanized scoring; not comparable) |
| Sarvam Saaras v3 (current API) | Feb 2026 | — | 22 + en | 5 modes incl. codemix | Yes | — | **No open weights** (the only open Sarvam audio model, Shuka v1, does audio Q&A, not transcription) | ~19% WER on IndicVoices (Sarvam) |
| Meta Omnilingual ASR (300M–7B) | Nov 2025 | 0.3–7B | All (1,600+ languages) | No | — | CTC-7B ~15 GiB | **Apache-2.0** | VoI 44.5–62.5, **poor on real Indian speech** |
| Meta MMS-1b-all / ai4bharat/indic-seamless | 2023 / 2024–25 | 1B / 2B | — | — | — | — | **CC-BY-NC (non-commercial), excluded** | — |
| NVIDIA Canary-1b-v2 / Parakeet-tdt-0.6b-v3 | Aug 2025 | 1B / 0.6B | **No Indic** (25 European languages) | — | Word and segment | Parakeet RTFx 3,332 | CC-BY-4.0 | n/a (but Canary is the **base** of Indic-Transcribe) |
| Voxtral Mini 3B, Qwen3-ASR-1.7B | Jul 2025 / Jan 2026 | 3B / 2B | **Only hi + en** of ours | — | Qwen: forced aligner (not Hindi) | Voxtral ~9.5 GB bf16 | Apache-2.0 | No Indic numbers |
| Gemma 3n E4B (audio) | Jun 2025 | ~4B effective | Unclear | — | No | — | Gemma Terms | VoI 36.1 |
| IBM Granite Speech, Kyutai STT, Phi-4-multimodal, SenseVoice, Bhashini/ULCA, BharatGen, Gnani, Krutrim speech | — | — | **Not verified this session** (believed to have little or no Dravidian coverage) | | | | | |

**What this means for us:**
- **Flex is the most promising.** It is the only open model found that natively produces our codemix style. Core's better score comes with native-script output, which would bring back the "mean → மீன் (fish)" problem the handbook describes.
- **IndicConformer and SraVaani are the low-risk options** (MIT licence, small). They have no English support and no documented code-mix handling, so Indian-English lectures need Whisper or Indic-Transcribe.
- **No candidate documents timestamps.** This is acceptable: ClassPulse cites 15–30 s phrases, so the time window of each ≤30 s VAD chunk can serve as the segment timestamp, as Sarvam's phrase timestamps do today.

### 3.2 Supporting components

| Need | Component | Notes |
|---|---|---|
| Voice activity detection and chunking | **Silero VAD** (MIT, ~2 MB, <1 ms per chunk on CPU; built into faster-whisper `vad_filter=True`) | Split long lectures at pauses into ≤30 s chunks, which Canary/Indic-Transcribe models expect. Keep each chunk's start/end time for citations. |
| Long audio | Indic-Transcribe `transcribe_long` or NeMo batched long-audio; faster-whisper batched mode | Canary-1b-v2 uses dynamic chunking with 1 s overlap. Measure hallucination and repetition on 25–60 min lectures. |
| Speaker diarization (optional: teacher vs students) | **pyannote speaker-diarization-community-1** (CC-BY-4.0, gated; DER 17.0 on AMI-IHM) | Not needed for quizzes today. Could later drop student chatter from transcripts. |
| Word timestamps (optional) | faster-whisper `word_timestamps`; CTC forced aligners (ctc-forced-aligner, MMS aligner: UNVERIFIED) | Only if we want word-level seek. |
| Punctuation / ITN for Indic | Indic-Transcribe flex mixed-script does ITN; IndicPunct and similar UNVERIFIED | The LLM tolerates missing punctuation, so low priority. |

---

## 4. LLMs for quizzes, summaries, assignments, grading, lesson plans and question papers

### 4.1 India-focused open models

| Model | Released | Size | Context | Licence | Indic evidence | Memory, weights only: BF16 / 8-bit / 4-bit | Verdict |
|---|---|---|---|---|---|---|---|
| **Sarvam-30B** (`sarvamai/sarvam-30b`; FP8 and GGUF repos exist) | Mar 2026 | MoE: 32B total, **2.4B active** | Unclear: evals ran at 65,536 tokens; press says 32K | **Apache-2.0** | MILU 76.8 (self-reported; table on card). Sarvam "indivibe" ~89% pairwise win rate (LLM-judged). Tokenizer built for 22 languages and 12 scripts. | ~64 / 32 / 18–19 GB (calc) | **Shortlist.** vLLM needs a hotpatch or fork; SGLang works. JSON-schema reliability untested. |
| **Sarvam-105B** | Mar 2026 | MoE: 106B total, 10.3B active | 128K (YaRN) | **Apache-2.0** | "Wins 90% of pairwise comparisons" on Indic (self-reported); IFEval 84.8 | ~212 / 106 / 58–64 GB (calc) | Stretch (80 GB GPU). |
| Sarvam-M | May 2025 | 24B dense (Mistral Small 3.1 base) | — | Apache-2.0 | +20% on Indic benchmarks vs its base model | ~48 / 24 / 14 GB (calc) | Superseded (deprecated on Sarvam's own API). |
| Sarvam-Translate | 2025 | 4B (Gemma 3) | 8K | **GPL-3.0** | No published scores | ~8 GB | Licence issues if distributed. |
| Sarvam-1 | 2024 | 2B | 8K | **Non-commercial** | MILU 30.25 | — | Excluded. |
| Krutrim-2-instruct | early 2025 | 12B | 128K | Krutrim Community License (custom) | IN22 en→xx chrF++ 0.45 (GPT-4o 0.44) | ~24 / 12 / 7 GB (calc) | Possible, but older and with a custom licence. |
| BharatGen Param2-17B-A2.4B | Feb 2026 | 17B MoE | 32K | **Non-commercial** | IFEval 34 | — | Excluded. |
| IndicTrans2 (AI4Bharat) | 2023 | 1B (distilled 200–320M) | Sentence-level | **MIT** | Reference Indic MT system (IN22) | <2 GB | Optional **translation stage** for bilingual fields. |
| Bodhan Indic-Translate | Sep 2026 | 4B (Gemma 4 E4B fine-tune) | 32K | Indic Open Model License (UNVERIFIED for this repo) | In-house doc test: dBLEU 58.97 vs Sarvam-Translate 47.44 (self-reported) | ~8 GB | Optional translation stage. |
| Airavata, Navarasa, Nemotron-4-Mini-Hindi, Param-1 | 2024–25 | 3–9B | — | various | MILU near random | — | Outdated. |

### 4.2 General open-weight models (fit on one or two GPUs)

| Model | Released | Size | Context | Licence | Multilingual / Indic evidence | Vision? | Memory, BF16 / 8-bit / 4-bit | Notes |
|---|---|---|---|---|---|---|---|---|
| **Qwen3.5-27B** | Feb 2026 | 27B; single FFN (dense) with **hybrid attention**: only 1 in 4 layers uses full attention (Gated DeltaNet in the others) | **262K** | **Apache-2.0** | 201 languages; MMMLU 85.9; WMT24++ 77.6. No Indic-specific numbers. | **Yes** (OCRBench 89.4) | ~54 / 27 / 15–16 GB (calc) | Thinking mode is on by default; turn it off (`enable_thinking: false`) for speed. Hybrid attention should keep the long-transcript KV cache small (calc, UNVERIFIED). Install vLLM nightly / SGLang main. |
| **Qwen3.5-35B-A3B** / 122B-A10B | Feb 2026 | MoE: 3B / 10B active | 262K | Apache-2.0 | Same family | Yes | 35B: ~70 / 35 / 20 GB (calc) | 35B-A3B is the **speed** option. |
| **Gemma 4 31B** / 26B-A4B / 12B / E4B | Apr 2026 | 31B dense; 26B MoE (~4B active) | 256K (31B) | **Apache-2.0** (Gemma 3 used custom terms) | 140+ languages; MMMLU 88.4 (31B), 83.4 (12B) | **Yes**; card claims handwriting OCR | 31B: ~61 / 31 / 17–18 GB (calc) | Native function calling. Sarvam also hosts it on its API. |
| **gpt-oss-20b** / **gpt-oss-120b** | Aug 2025 | MoE: 21B / 3.6B active; 117B / 5.1B active | 128K (UNVERIFIED; not on card) | **Apache-2.0** | MILU 73.7 (20b, per Sarvam's card) | No | **Official:** 20b within 16 GB (MXFP4); 120b on one 80 GB GPU | Requires the "harmony" format (vLLM handles it). Native structured outputs. Reasoning effort low/medium/high. |
| Qwen3 (2025) incl. 30B-A3B / 32B | Apr 2025 (2507 updates) | various | 128K | Apache-2.0 | 119 languages incl. all 10 of ours; **MILU 82.6** for Qwen3-30B-Thinking-2507, the best open score on Sarvam's table | No | 32B: ~64 / 32 / 18 GB (calc) | Good fallback if Qwen3.5 has serving issues. |
| Mistral Small 3.2 (24B) | Jun 2025 | 24B | 128K (UNVERIFIED) | Apache-2.0 | MILU 67.9 | Yes | Official ~55 GB bf16 | Fallback. |
| Llama 4 Scout | Apr 2025 | 109B MoE (17B active) | 10M | Llama 4 licence (attribution; 700M-MAU clause) | Hindi is the only officially supported Indic language | Yes; best open model at Indic **printed** OCR in IndicVisionBench | int4 on one H100 (official) | Heavy; licence has extra duties. |
| Llama 3.1/3.3 (8B/70B) | 2024 | dense | 128K | Llama licence | MILU 35.0 (8B) / 58.3 (70B), weak | No | 70B: ~140 / 70 / 40 GB (calc) | Not recommended. |
| DeepSeek V3/R1 distills, Phi-4, Granite, Nemotron, Kimi K2, GLM | — | — | — | Not verified this session | GLM-4.7-Flash MILU 75.6 (Sarvam card) | — | — | Full-size DeepSeek, Kimi and GLM models exceed two GPUs. |

**Indic quality evidence, and its weakness.** The most useful comparison of current open models is the **MILU** table on Sarvam-30B's model card, but it is **self-reported by Sarvam**:

| Model | MILU |
|---|---|
| Qwen3-30B-Thinking-2507 | 82.6 |
| Sarvam-30B | 76.8 |
| GLM-4.7-Flash | 75.6 |
| gpt-oss-20b | 73.7 |
| Gemma-27B-it | 69.2 |
| Mistral-3.2-24B | 67.9 |

For reference, the original MILU paper scored GPT-4o at 74.74. MILU is multiple-choice knowledge, **not** generation quality in Tamil or Telugu. **No independent benchmark compares Qwen3.5, Gemma 4, gpt-oss and Sarvam on Indic generation**, so our own evaluation (§7) is necessary.

### 4.3 Vision models for grading photos of handwritten work

| Option | Size / licence | Indic handwriting evidence | Notes |
|---|---|---|---|
| **Qwen3.5-27B** (native vision) | 27B, Apache-2.0 | OCRBench 89.4; **no Indic numbers** | One model for text and vision means simpler operations. |
| **Gemma 4 31B** | 31B, Apache-2.0 | Claims handwriting and multilingual OCR. **65.5** on Sarvam's Indic OCR Bench (printed; Sarvam-reported). | |
| Qwen3-VL-8B | ~9B, Apache-2.0 | OCR in 32 languages (list not given); reads printed Hindi well (preprint) | Option for a 24 GB GPU. |
| **bodhan-ai/indic-doc-parser** (IndicOCR) | 33M layout + 0.8B OCR (Qwen3.5-0.8B architecture); Indic Open Model License | **Handwriting in English + 12 Indian languages.** Word accuracy: overall 66.7; en 80.7, hi 77.6, ta 76.8, bn 71.3, mr 70.2, kn 69.6, pa 69.4, or 68.2, ml 60.5, gu 55.9, te 53.5 ("work in progress") | Two-step design: OCR the photo, then a text LLM grades it. Served with vLLM. |
| PaddleOCR-VL | 0.9B, Apache-2.0 | 109 languages; only Hindi confirmed among Indic | Cheap first pass. |
| Llama 4 Scout | 109B MoE | Best open model on Indic printed OCR (IndicVisionBench) | Needs an H100. |
| Chitrarth-1 (Krutrim) | 7.5B | OCR word error **99.1** in IndicVisionBench, so it fails | Excluded. |
| Sarvam Vision 2.1 | API only | Best published Indic OCR (87.39) and supports handwriting | **Not self-hostable**; a possible hybrid fallback. |

**Conclusion on vision.** Indic handwriting is the weakest area for open models. Treat local grading of handwritten work as **experimental**. Benchmark it on real student photos. Keep the teacher review step (already mandatory) and the API fallback. IndicVisionBench also found GPT-4o weak at Indic OCR, so our *current* photo-grading path may be weaker than assumed for Indic scripts. That is an inference; measure it.

### 4.4 Structured JSON output: what is and isn't guaranteed

- vLLM and SGLang accept the same `response_format: {type: "json_schema", ...}` request ClassPulse already sends. Their grammar backends (XGrammar, Guidance) restrict generation so the output **always parses and matches the schema**.
- JSONSchemaBench (2025) shows engines support complex schema features unevenly. Compliance on hard real-world schemas: Guidance 0.69, llama.cpp 0.63, XGrammar 0.41, Outlines 0.06.
  - Our schemas are simple (objects, arrays, strings, numbers), so this should be fine.
  - Avoid `oneOf` / `patternProperties`.
  - Test every schema in the harness.
- Constrained decoding did **not** reduce task accuracy in that study (Llama-3.1-8B GSM8K: 80.1% unconstrained vs 83.7–83.8% constrained).
- It **does not** guarantee correct *content*. A wrong answer key, an invented citation or a bad translation still passes the schema. Our existing validator (4 distinct options, 1 correct, citations that exist, translations present) plus the human evaluation in §7 cover this.

---

## 5. Serving software

| Stack | Fit for ClassPulse | Key facts |
|---|---|---|
| **vLLM** (recommended) | OpenAI-compatible `/v1/chat/completions` (JSON schema, image input) and `/v1/audio/transcriptions` | Structured outputs via `response_format` json_schema with XGrammar or Guidance. (The old `guided_json` fields were removed in v0.12.0.)<br>Transcription endpoint serves Whisper, Voxtral, Qwen3-ASR, Granite Speech, Gemma 3n and others, but **not** Parakeet or the Indic-Transcribe/Conformer models.<br>Quantization: AWQ, GPTQ, GGUF, FP8 (**Ada/Hopper only**: L4, L40S, RTX 4090, H100; **not** A100/A10G), MXFP4. |
| SGLang | Same OpenAI API; XGrammar by default | Sarvam's recommended engine for Sarvam-30B/105B. |
| llama.cpp / Ollama | JSON schema converted to a grammar; GGUF quantization | Good for a developer laptop or an RTX workstation. Weaker for many concurrent users. |
| HF TGI | **Archived 2026-03-21** (maintenance mode) | Do not use. |
| faster-whisper (CTranslate2) | Python library; needs a small HTTP wrapper | Fastest Whisper path, with Silero VAD and word timestamps. |
| NeMo / custom Python (FastAPI) | For Indic-Transcribe, IndicConformer, SraVaani | Wrap as an OpenAI-style `/v1/audio/transcriptions` "sidecar" (see §8). |
| TensorRT-LLM, NVIDIA NIM/Riva, Triton | Not evaluated this session | Revisit only for higher scale. |

**Recommended stack**
- **vLLM** for the LLM: one model per GPU process, with `--api-key` set.
- A **small Python STT sidecar** exposing `/v1/audio/transcriptions`. It runs Silero VAD, then Indic-Transcribe or faster-whisper, and returns `verbose_json` segments.
- Both run in Docker with NVIDIA Container Toolkit on a GPU host.

---

## 6. Hardware sizing and cost

### 6.1 GPUs

| GPU | Memory | Bandwidth | FP8 | Comment |
|---|---|---|---|---|
| NVIDIA L4 | 24 GB | 300 GB/s | Yes | Cheap and low power (72 W). Fine for STT; slow for big LLMs (low bandwidth). |
| A10G | 24 GB | ~600 GB/s (UNVERIFIED) | No | AWS g5. |
| **L40S** | **48 GB** | 864 GB/s | Yes | **Best single-GPU fit** for STT plus a 27–32B model. |
| A100 80GB | 80 GB | ~2 TB/s (UNVERIFIED) | No | |
| H100 SXM / NVL | 80 / 94 GB | 3.35 / 3.9 TB/s | Yes | For 100B-class MoE models (gpt-oss-120b, Sarvam-105B at 4-bit). |
| RTX 4090 / 5090 (own hardware) | 24 / 32 GB | ~1 / ~1.8 TB/s (UNVERIFIED) | Yes (Ada / Blackwell) | Fast and cheap to own; consumer cards, single-slot memory limits. vLLM gpt-oss MXFP4 on Ada/5090 was "in progress". |

**Memory rule of thumb.** Total memory = weights + KV cache (grows with transcript length) + about 20–30% overhead.
- KV cache for Llama-3.1-8B is **128 KiB per token**, so ~5 GiB for a 40k-token transcript.
- A conventional 32B model is about 256 KiB per token (calc), so ~10 GiB at 40k tokens.
- Hybrid or MoE models (Qwen3.5, Sarvam) need less (UNVERIFIED).
- Example: a 32B model at 4-bit with a 40k-token context needs about **30 GB**. That fits an L40S, not an L4.

### 6.2 Setups, what they run, and rough capacity

Capacity figures are **estimates** and must be measured in §7.

| Setup | What fits | Lecture-hours transcribed per GPU-hour | Quizzes (20 questions, 1-hour lecture) per GPU-hour |
|---|---|---|---|
| **(1) STT only:** 1× L4 24 GB or RTX 4090 | Indic-Transcribe (~9 GB) or faster-whisper large-v3 (~3–6 GB) | ~20–75 (vendor: 77× real time; faster-whisper ~45× on a laptop-class GPU) | — |
| **(2) STT + ~8–20B LLM:** 1× L40S 48 GB (an L4 only works if STT and LLM take turns) | STT (~9 GB) + gpt-oss-20b (~16 GB) or Qwen3.5-35B-A3B at 4-bit (~20 GB) + KV cache | same | ~30–100 (est.; MoE models with 3–4B active parameters decode fast; batching helps) |
| **(3) STT + 24–32B LLM:** 1× L40S 48 GB (4-bit/FP8) or 1× A100/H100 80 GB | STT + Qwen3.5-27B / Gemma 4 31B / Sarvam-30B | same | ~10–40 on L40S (est.: single-stream dense 32B ≈ 20–35 tokens/s, so **~4–7 min per quiz** without batching) |
| **(4) 70–120B class:** 1× H100 80 GB (+ a small GPU for STT) | gpt-oss-120b, Sarvam-105B at 4-bit, Qwen3.5-122B-A10B at 4-bit | — | ~20–60 (est.; MoE with 5–10B active) |

**Latency matters more than throughput here.** Teachers click "Generate" and wait, and today that takes about 21 s. A dense 27–32B model on an L40S could take several minutes for a bilingual 20-question quiz (est.). This is a real UX risk.

Mitigations to test:
- MoE models (Qwen3.5-35B-A3B, Sarvam-30B, gpt-oss-20b).
- Thinking or reasoning switched off.
- FP8 instead of 4-bit.
- Streaming progress in the UI.

### 6.3 Rental prices (on demand, approximate, seen 2026-10-11)

| Provider | L4 | L40S | A100 80GB | H100 |
|---|---|---|---|---|
| **E2E Networks (India, ex-GST)** | ₹49/hr (~$0.56) | ₹102/hr (~$1.16) | ₹189/hr | ₹255.55/hr (₹155.90 committed) |
| AWS Mumbai (g6.xlarge / g5 A10G) | ~$0.97 (aggregator) | g6e: ~$1.86 (us-east-1, aggregator) | — | — |
| GCP g2-standard-4 (L4) | ~$0.71–0.74 (aggregator; check GCP) | — | — | — |
| RunPod (secure / community) | $0.49 / $0.44 | $1.09 / $0.79 | $1.59 / $1.19 | $2.69–3.49 |
| Lambda | — | — | $2.79 | $3.29–4.29 |
| Modal (per second) | $0.80 | $1.95 | $2.50 | $3.95 |
| IndiaAI Mission (subsidised, eligible users) | ₹65/GPU-hr average quoted by PIB; no official per-GPU rate card found | | | |

Azure and Oracle OCI GPU prices were not obtained. RTX 4090/5090 purchase prices in India were not obtained.

### 6.4 Break-even against today's APIs

Today's cost is about **₹32–34 per lecture-hour** (STT ₹30 + LLM ₹2–4, est.).

| Local setup | Monthly cost if always on (730 h) | Break-even volume | Monthly cost if run on a schedule |
|---|---|---|---|
| 1× L4 @ ₹49/hr (STT only; quiz stays on OpenAI) | ≈ ₹35,800 | ≈ **1,200 lecture-hours/month** (vs ₹30 STT) | 10 h × 22 school days ≈ ₹10,800 → break-even ≈ 360 h/month |
| 1× L40S @ ₹102/hr (STT + LLM) | ≈ ₹74,500 | ≈ **2,300 lecture-hours/month** | 10 h × 22 days ≈ ₹22,400 → break-even ≈ 700 h/month |
| 1× H100 @ ₹256/hr | ≈ ₹186,800 | ≈ 5,700 lecture-hours/month | Benchmark use only |

**What 1,200 lecture-hours a month looks like:** about 15 classrooms × 5 recorded periods × 22 days × 45 min.

At pilot scale, the APIs are cheaper. Self-hosting starts to win on cost:
- when several schools are on board, or
- when the GPU runs only during school hours (STT and grading can also be **queued overnight**).

Privacy (audio never leaves our infrastructure) is a benefit at any scale.

---

## 7. Benchmark plan (for when GPUs arrive)

### 7.1 Goals and decision

Decide, with evidence, for each job (STT, quiz LLM, grading) whether a local model is **non-inferior** to the current API on our real classroom content, at acceptable speed and cost. Whatever is not good enough stays on the API.

### 7.2 Shortlist and why

| Job | Candidates | Reason |
|---|---|---|
| STT (4 + baselines) | Indic-Transcribe-flex (mixed-script), Indic-Transcribe-core, IndicConformer-600M, SraVaani-1.0; baselines: **Sarvam saaras:v3 codemix (current)**, faster-whisper large-v3 and large-v3-turbo | Best published Indic results; MIT safety net; Whisper for en-IN and tooling. |
| LLM (5 + stretch) | Qwen3.5-27B, Qwen3.5-35B-A3B, Sarvam-30B, Gemma 4 31B, gpt-oss-20b; stretch on H100: Sarvam-105B, gpt-oss-120b; **reference: gpt-4.1-mini (current)** | All Apache-2.0; mix of dense (quality) and MoE (speed); India-first (Sarvam) vs global. |
| Vision grading (2 + pipeline) | Qwen3.5-27B, Gemma 4 31B; pipeline: indic-doc-parser OCR → best text LLM; **reference: current OpenAI model** | Only options with claimed handwriting/OCR capability and permissive licences. |

### 7.3 Test sets

**A. ClassPulse classroom set** (most important; decides the outcome):

| Subset | Content | Target size |
|---|---|---|
| Existing 3 recordings (repo root) | Tamil+English Java/JDBC (22 min), English UPI (11 min), Tamil statistics (25 min) | ~1 h, all fully transcribed |
| New pilot recordings (collect before GPUs arrive) | Real lectures from pilot schools in their language mix | **≥ 2 h each** for Tamil(+English), Hindi(+English), Telugu and Indian English; **30–60 min each** for the other 7 languages where available. Total ~12–15 h. |
| Code-mix subset | Utterances containing English technical terms, tagged | ≥ 300 utterances, with a **term list per lecture** (e.g. JDBC, ResultSet, mean, median, UPI, NPCI) |
| Hard-audio subset | Fan noise, students talking, far microphone (Raspberry Pi recorder), long silences | ≥ 1 h |

**How to make reference transcripts:**
- Write a 1-page guideline that matches our codemix convention: Indic words in native script, English words in Latin, numerals as digits, no filler words, and fixed spelling of technical terms.
- To avoid favouring Sarvam, **do not** start annotators from Saaras output. Start from a model that is *not* in the comparison (or from a blend), and have a native-speaker annotator correct it fully against the audio.
- A second annotator reviews 10–20% of it. Report inter-annotator WER, which is the "noise floor".
- Effort (est.): about 4–8 annotator-hours per audio hour.

**B. Public sets** (for comparability and regression; download needs Hugging Face gated access):

| Set | Use | Size to use |
|---|---|---|
| **IndicVoices** (AI4Bharat, CC BY 4.0, 22 languages, mostly extempore) | Main public Indic set | ~1 h test per language × 10 languages |
| Kathbath / Vistaar benchmark | Read speech; comparable to published numbers | 30 min per language |
| FLEURS (Indic subsets) | Comparable with global models | Full test split per language (small) |
| **Svarah** (Indian-accented English, 9.6 h, CC BY 4.0) | en-IN | 2 h |
| Lahaja (Hindi accents, 12.5 h) | Hindi robustness | 2 h |
| Code-mixed sets (MUCS 2021 hi-en / bn-en) | Public code-mix | UNVERIFIED availability; use if obtainable |
| Voice of India | **Closed** benchmark; cannot be run by us | Cite only |

**C. LLM sets:**
- Transcripts of **20 lectures**: our classroom set plus public lecture-style audio, at least 3 per main language.
- Each is run through **the same fixed transcript** (the human reference) so LLM tests are not confounded by STT errors.
- A second pass uses each STT candidate's transcript, to measure the end-to-end effect.
- Requests to run: `20 × Mixed`, `10 × Hard`, `5 × Easy append`, and `replace_unapproved`, each with bilingual on and off.

**D. Grading set:**
- **100–200 real student submissions**: typed answers plus photos of handwritten work in at least English, Tamil and Hindi.
- Each comes with **teacher marks per rubric criterion**, which are the ground truth.
- For 50 photos, also make human transcriptions of the handwriting, to score OCR separately.
- Get consent and anonymise the photos (crop names).

### 7.4 Metrics

**Speech-to-text**

| Metric | How |
|---|---|
| WER and CER (raw) | `jiwer` after normalisation: Unicode NFC, Indic normaliser (nukta and zero-width-joiner handling via indic-nlp-library), lower-case Latin, strip punctuation, one digit form |
| **Script-normalised WER** | Transliterate reference and hypothesis to one script before scoring, so "JDBC" vs "ஜேடிபிசி" is not double-counted (ideas from SN-WER, T-WER and toWER). Report next to raw WER, not instead of it. |
| OIWER / LLM-WER (optional) | Voice of India's `voi-oiwer` scorer; Sarvam's LLM-judged WER approach. LLM judges must be pinned and run at temperature 0. |
| **Technical-term recall** | Share of listed English terms that come out **correctly in Latin script**. This is the most important metric for quiz quality. |
| Timestamp quality | Mean start/end offset of segments vs a forced-aligned reference on 10 minutes per language. **Citation hit rate**: share of quiz citations whose time window actually contains the supporting sentence. |
| Robustness | Hallucinated or repeated text on silence and noise (count per hour); failures on 60-min audio |
| Speed and resources | RTF (processing time ÷ audio time), peak GPU memory, cold-start time |
| Cost | ₹ per audio-hour = GPU ₹/hr × processing time, at 50% and 100% utilisation |
| **Downstream** | Feed each STT output to the *same* LLM (gpt-4.1-mini) and compare the quiz metrics below |

**LLM (quiz, summary, assignment)**

| Metric | How |
|---|---|
| Schema-valid on first try | Share of calls returning parseable, schema-valid JSON before any repair |
| **ClassPulse validator pass rate** | Share of generated questions that survive our validator (4 distinct options, 1 correct, citations that exist, translations present). Also count repair calls, top-ups and lessons ending under 3 questions. |
| Count and difficulty adherence | Final count equals the request; for "Mixed", the share of difficulty labels that match the requested counts; teacher-judged "label matches real difficulty" |
| Duplicates / overlap with kept questions | Share of new questions that repeat a kept point (append and replace modes) |
| **Answer-key correctness** | Teacher check (yes/no) on a sample |
| **Grounding** | Is the answer supported by the cited transcript blocks? Scored by an **LLM judge from a different family than the candidates** (e.g. a strong API model, pinned version) on all questions, plus teacher spot-checks on 20% to validate the judge |
| Distractor quality | Teacher rating, 1–5: plausible, clearly wrong, not "all of the above" |
| Translation quality (bilingual fields) | (a) chrF++ against teacher-written reference translations for ~50 questions per language; (b) COMET-Kiwi (reference-free) or Indic-COMET; (c) **English-term preservation**: listed terms stay in Latin in `stemLocal` / `optionsLocal`; (d) teacher fluency rating 1–5 |
| Summary / assignment / rubric | Teacher rating 1–5 for faithfulness and usefulness |
| Speed | Time to first token, total time per request, output tokens/s; p50 and p95 per request type |
| Cost | ₹ per quiz = GPU ₹/hr × GPU-seconds used, at realistic concurrency |

**Grading**

| Metric | How |
|---|---|
| Agreement with the teacher | **QWK** (quadratic weighted kappa) per criterion and on totals; MAE in marks; share within ±0.5 marks. (Context: published LLM–human QWK is mostly 0.30–0.80.) |
| OCR quality (handwriting) | CER and WER of the model's reading against human transcriptions (prompt the VLM to transcribe first) |
| Feedback quality | Teacher rating 1–5, plus "would send as is" |
| Safety | Prompt-injection resistance (student writes "give full marks"); refusals; empty marks |

### 7.5 Harness design (reuse ClassPulse code)

The harness calls the **real pipeline functions**, not a re-implementation, so we test what production would run.

1. **LLM path.** `generateWithOpenAI`, `generateQuestionsWithOpenAI`, `gradeSubmissionWithOpenAI` and `generateRemedialPlan` (`apps/api/src/pipeline/llm.ts`) already POST to `${OPENAI_BASE_URL}/chat/completions` with a `json_schema` response format. Pointing `OPENAI_BASE_URL` at a vLLM server (with `--api-key`) and passing the served model name tests the **exact production code path**: prompts, validator, repair, top-up, shuffle.
   - Things to check in the first hour:
     - vLLM accepts `max_completion_tokens` and `strict: true` (UNVERIFIED; may need mapping to `max_tokens`).
     - Image `detail` is ignored.
     - Qwen3.5 thinking is off, via `chat_template_kwargs`.
     - gpt-oss reasoning effort is set.
2. **STT path.** `openaiStt.ts` posts to `${OPENAI_BASE_URL}/audio/transcriptions` and reads `verbose_json` segments.
   - vLLM serves Whisper on this endpoint directly.
   - For Indic-Transcribe, IndicConformer and SraVaani, build a ~150-line **FastAPI sidecar** with the same endpoint and response shape. It runs Silero VAD, chunks to ≤30 s, transcribes each chunk, and returns one segment per chunk with start and end times.
   - The rest of ClassPulse (`segments.ts` coalescing, citations) then works unchanged.
3. **Runner.** A script (proposed: `apps/api/scripts/bench/run.ts`) loops over models × lectures × request types × runs. It writes one JSONL row per call with: inputs hash, model, raw output, validator result, timings, token counts and GPU memory (sampled with `nvidia-smi`).
4. **Scorer.** Python notebooks: `jiwer`, `indic-nlp-library`, `sacrebleu` (chrF++), `unbabel-comet`, and `scikit-learn` `cohen_kappa_score(weights="quadratic")`. They produce one results table per job.
5. **Blind rating sheet.** Questions from all models are shuffled into a spreadsheet or a small internal page with model names hidden. Teachers rate them there.
6. **Load test.** `vllm bench serve` (or a simple concurrency script) with 1, 4 and 8 concurrent quiz requests on 1-hour transcripts, to get realistic p95 latency.

### 7.6 Procedure and statistics

- **Settings frozen per model:** temperature (use the vendor default, or 0.3 for quiz writing), max tokens, quantization, vLLM version. Record everything.
- **Runs:**
  - STT is near-deterministic: 1 run per file, with a repeat on 10% to confirm.
  - LLM: **3 runs per (lecture × request type)**, giving about 20 lectures × 4 requests × 3 runs = 240 calls per model.
- **Paired comparison.** Every model sees the same inputs. Compare each local model with the current API on the same item:
  - **paired bootstrap** (10,000 resamples, by lecture) for 95% confidence intervals of WER, CER and rate differences;
  - **McNemar** test for pass/fail outcomes such as answer-key correctness;
  - **Wilcoxon signed-rank** for teacher 1–5 ratings.
  - Report effect sizes with confidence intervals, not just p-values.
- **Non-inferiority framing.** A local model "passes" if the upper confidence bound of (local − API) error stays within the margin in §7.8.
- **Order:**
  1. STT first, because it is the cheapest to run and the biggest cost item.
  2. Then LLMs on reference transcripts.
  3. Then end-to-end with the best STT.
  4. Then grading.

### 7.7 Human evaluation protocol with teachers

**Raters:** 4–6 subject teachers who speak the lesson languages (at least 2 per main language), briefed with a 1-page rubric and 10 calibration examples.

**Sample:**
- **150 questions per model** (stratified by language and difficulty), each rated by **2 teachers**. Report Cohen's kappa between raters; disagreements go to a third teacher.
- 30 summaries and assignments per model.
- 100 grading suggestions per model.

**Blind and randomised:** model identity hidden; questions from different models interleaved; API outputs included as one of the "models".

**Per-question rubric:**

| Item | Scale |
|---|---|
| Answer key correct | yes / no |
| Grounded in the lecture | yes / no |
| Clear and unambiguous | 1–5 |
| Distractors plausible and clearly wrong | 1–5 |
| Difficulty label right | yes / no |
| Local-language version natural, terms kept in English | 1–5 |
| Overall | use as is / minor edit / reject |

**Effort (est.):** about 1 minute per question, so 150 × 6 models × 2 raters ≈ 30 teacher-hours in total. Pay or credit the teachers.

### 7.8 Pass / fail thresholds to adopt a local model (proposed; adjust after the pilot)

| Job | Must meet all |
|---|---|
| **STT** | (1) Script-normalised WER on the ClassPulse set no worse than Saaras v3 by more than **2 points absolute** (95% CI), overall **and** for each main language.<br>(2) **Technical-term recall ≥ 95% of Saaras's.**<br>(3) No catastrophic failure (hallucination loop, empty output) on any lecture up to 60 min.<br>(4) RTF ≤ 0.1 on the target GPU.<br>(5) Licence confirmed in writing for our use. |
| **Quiz LLM** | (1) Schema-valid output **100%** after constrained decoding; ≤ 5% of lessons need a repair call.<br>(2) Validator pass ≥ 95% of questions; 0 lessons failing for "too few questions" where gpt-4.1-mini succeeds.<br>(3) Answer-key correctness ≥ 98%; grounding ≥ 95%.<br>(4) Teacher "use as is or minor edit" rate no worse than gpt-4.1-mini by more than **5 points**.<br>(5) Bilingual: term preservation ≥ 95%; teacher fluency not worse by more than 0.3 on the 1–5 scale.<br>(6) **p95 time for a 20-question bilingual quiz on a 1-hour lecture ≤ 90 s** at expected concurrency. |
| **Grading** | (1) QWK vs teacher ≥ **0.70** on totals and no lower than the current API's by more than 0.05.<br>(2) MAE ≤ 0.5 marks per criterion on average.<br>(3) Handwriting OCR CER reported per language; enable local grading only for languages that pass. |

### 7.9 Rollout plan (if thresholds are met)

1. **Shadow mode (2 weeks).** Production still uses the APIs. Each job is *also* sent to the local model and both results are stored for comparison (`pipelineMeta`). Nothing changes for users. Teachers occasionally review side-by-side samples.
2. **Hybrid, opt-in per school.** In Admin → AI settings, choose "Local (on our server)" for STT and/or LLM. **Automatic fallback** to Sarvam/OpenAI when:
   - the local endpoint is down or times out;
   - the validator fails after repair;
   - local STT returns empty or suspicious output (e.g. extreme words-per-minute).
   Log every fallback.
3. **Default local.** Keep API keys configured as fallback, monitor weekly quality samples, and re-run the benchmark (same harness) before upgrading any model.

### 7.10 Risks and mitigations

| Risk | Mitigation |
|---|---|
| Code-mix accuracy on real classrooms worse than published numbers | Our own test set decides. Keep the hybrid fallback. Consider fine-tuning (NeMo) on corrected pilot transcripts later. |
| **Licence**: Indic Open Model License (Bodhan) requires approval for third-party API hosting. ClassPulse uses the model internally, but get **written confirmation**. Attribution may be required. | Ask Bodhan early. IndicConformer and SraVaani (MIT) are the fallback. All shortlisted LLMs are Apache-2.0. |
| Slow quiz generation with dense models | Prefer MoE models; switch thinking off; FP8; stream progress; queue non-urgent jobs |
| GPU availability and cost; single point of failure | API fallback; scheduled GPU; one spare provider (E2E plus RunPod) |
| Maintenance (drivers, CUDA, vLLM upgrades, model downloads, gated HF tokens) | Pin Docker image versions; run the harness as a regression test before upgrades; budget ~2–4 h/week of operations (est.) |
| Security: GPU host exposed | Private network (WireGuard/Tailscale) between the API server and GPU host; `--api-key`; no public port |
| Self-reported benchmarks mislead | Trust only our own numbers for the decision |
| Data protection (DPDP Act 2023; Rules notified 2025, UNVERIFIED final text) | Local processing reduces transfers to third parties. Host the GPU in India. Keep retention rules (30-day audio). |

### 7.11 Timeline and effort (about 3 weeks)

| Week | Work | People |
|---|---|---|
| **Week 0 (before GPUs)** | Licence emails (Bodhan, gated HF access); reference transcripts for existing and new recordings; term lists; collect grading samples with teacher marks; build harness and STT sidecar; download public test sets | 1 engineer; 2–4 annotators (~40–80 h total, est.); teachers for marks |
| **Week 1 (GPU)** | Stand up vLLM and sidecar; STT benchmark (all candidates × all sets); pick the top 2 STT models | 1 engineer |
| **Week 2 (GPU)** | LLM benchmark (5 models + stretch on 1 day of H100); vision grading benchmark; load and latency tests | 1 engineer |
| **Week 3** | Teacher blind ratings (~30 teacher-hours); statistics; decision memo; if yes, implement the provider (§8) and start shadow mode | 1 engineer + 4–6 teachers |

GPU budget for the benchmark (est.): about 60–80 L40S hours (~₹6–8k) + about 8 H100 hours (~₹2k) at E2E rates, excluding GST.

---

## 8. ClassPulse integration notes (what code would change)

**No code was changed for this report.** This is the proposed change list.

| Area | File(s) | Change |
|---|---|---|
| Provider enums and dropdowns | `packages/shared/src/settings.ts` | Add `'local'` to `SttProvider` and `LlmProvider`. Add `STT_MODELS.local` (e.g. `indic-transcribe-flex`, `whisper-large-v3-turbo`) and local LLM options (e.g. `qwen3.5-27b`). Extend `ModelSettings.configured` with `local: boolean`. |
| Pipeline types | `apps/api/src/pipeline/types.ts` | `TranscribeInput.provider: 'sarvam' \| 'openai' \| 'local'`; meta records `fallbackFrom` when the API was used as a fallback. |
| Endpoint config | `apps/api/src/config/env.ts`, `infra/.env.example`, `apps/api/.env.example` | `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_API_KEY`, `LOCAL_STT_BASE_URL`, `LOCAL_STT_API_KEY`, `LOCAL_TIMEOUT_MS`, `LOCAL_FALLBACK_TO_API=true`. |
| LLM client | `apps/api/src/pipeline/llm.ts` | `chat()` currently hard-wires `env.OPENAI_BASE_URL` and `requireKey()`. Refactor it to take an endpoint `{baseUrl, apiKey, provider}`. Add per-model request tweaks: Qwen3.5 `chat_template_kwargs: {enable_thinking: false}`; gpt-oss reasoning effort; `max_tokens` fallback if needed. Prompts, schemas and validators stay unchanged. |
| STT client | new `apps/api/src/pipeline/localStt.ts`, or parameterise `openaiStt.ts` | Same `verbose_json` contract against `LOCAL_STT_BASE_URL`. The local sidecar has no 25 MB limit, so send the whole WAV (or keep 10-minute parts for progress). |
| Dispatch and fallback | `apps/api/src/pipeline/providers.ts` | Route `'local'` to the new clients. Wrap with a fallback: on retryable error, timeout or validator failure, retry once on the API provider and record it. Test overrides via `setPipelineProvidersForTests` keep working. |
| Admin UI | AI settings page (Admin → AI settings) | Show "Local (on our server)" with a health indicator (`GET /v1/models` on the endpoint). |
| Infrastructure | `infra/docker-compose.*.yml` (on a **GPU host**, not the OCI ARM box) | Services `vllm` (image `vllm/vllm-openai`, `--api-key`, model cache volume, `HF_TOKEN` for gated models) and `stt-sidecar` (Python, NeMo/transformers plus Silero VAD). GPU via `deploy.resources.reservations.devices: [{driver: nvidia, count: 1, capabilities: [gpu]}]`. Private network link to the API server. |
| Tests | `apps/api/test/*` | Contract tests for the local clients using a fake OpenAI-compatible server; fallback tests. |
| Docs | `docs/HANDBOOK.md` §8, `docs/deployment.md` | Describe local mode, fallback, GPU host operations (after the decision). |

**Privacy benefit.** In local mode, **lecture audio and transcripts never leave our infrastructure**. Today, audio goes to Sarvam and transcripts to OpenAI (handbook §8.7). This helps with school and parent trust and with India's DPDP obligations. Host the GPU in India (E2E, IndiaAI Mission or AWS Mumbai) to keep data in-country.

---

## 9. Open questions to resolve (before or during the benchmark)

1. Bodhan licence: does serving our own SaaS (model used internally, no direct model access for customers) need approval? Is attribution required in the UI?
2. Sarvam-30B maximum context (32K or 64K+)? This decides whether 1-hour Tamil transcripts (~30k tokens, est.) fit without chunking.
3. vLLM compatibility details: `max_completion_tokens`, `strict`, image `detail`; Sarvam-30B support in mainline vLLM.
4. Real speed of Indic-Transcribe on an L4 / L40S (the vendor's 77× figure has no GPU stated).
5. Do any candidates have usable word or segment timestamps? Otherwise VAD-chunk times are used.
6. Azure and OCI GPU prices; Indian purchase prices for an RTX 4090/5090 workstation (a buy-vs-rent option).
7. Models not checked this session: IBM Granite Speech, Kyutai, Phi-4-multimodal, SenseVoice, Bhashini/ULCA, BharatGen speech, Gnani, Krutrim, DeepSeek/Phi/Granite/Nemotron LLMs, InternVL, MiniCPM-V, olmOCR, dots.ocr.

---

## 10. Sources

Prices and pages seen 2026-10-11. "Self-reported" means numbers published by the model's own authors.

**Speech-to-text**
- Indic-Transcribe-core (model card, VoI table, licence summary): https://huggingface.co/bodhan-ai/indic-transcribe-core
- Indic-Transcribe-flex (modes, speed 77× / 9.2 GiB, licence terms): https://huggingface.co/bodhan-ai/indic-transcribe-flex
- Indic Open Model License v1.0 text (§0, 2, 3.1–3.3, 4.1, 5, 12, 14): https://github.com/Bodhan-AI/bodhan-model-info/blob/main/licenses/indic-open-model-license/v1/Indic_Open_Model_License.md
- Bodhan AI release coverage:
  - https://www.analyticsvidhya.com/blog/2026/09/bodhan-ai-indic-models/
  - https://news.careers360.com/iit-madras-suite-of-open-ai-models-for-indic-languages-bodhan-ai/amp
  - https://www.dtnext.in/news/chennai/iit-m-incubated-bodhan-ai-unveils-open-models-for-indian-languages
  - https://www.businesstoday.in/technology/artificial-intelligence/story/from-hindi-to-regional-accents-this-new-ai-model-is-built-to-understand-26-indian-languages-549708-2026-08-18
- Voice of India benchmark (closed, 15 languages, 536 h): https://arxiv.org/abs/2604.19151; scorer https://pypi.org/project/voi-oiwer
- IndicConformer 600M: https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual and https://github.com/AI4Bharat/IndicConformerASR
- SraVaani-1.0: https://huggingface.co/ARTPARK-IISc/SraVaani-1.0 and paper https://arxiv.org/abs/2608.08235 (table: https://arxiv.org/html/2608.08235)
- IndicWhisper / Vistaar benchmark: https://github.com/AI4Bharat/vistaar
- indic-seamless (CC BY-NC): https://huggingface.co/ai4bharat/indic-seamless
- Sarvam Shuka v1: https://huggingface.co/sarvamai/shuka_v1; Sarvam HF org: https://huggingface.co/sarvamai
- Sarvam ASR / Saaras v3 / Sarvam Audio blogs: https://www.sarvam.ai/blogs/asr and https://www.sarvam.ai/blogs/sarvam-audio
- Sarvam "Evaluating Indian Language ASR" (normalisation, LLM-WER, thresholds; 2 Apr 2026): https://www.sarvam.ai/blogs/evaluating-indian-language-asr
- faster-whisper benchmarks: https://github.com/SYSTRAN/faster-whisper
- Whisper large-v3-turbo: https://huggingface.co/openai/whisper-large-v3-turbo
- Whisper Hindi fine-tune (large-v3 baseline WER): https://huggingface.co/Oriserve/Whisper-Hindi2Hinglish-Prime
- Tamil Whisper fine-tune: https://huggingface.co/vasista22/whisper-tamil-large-v2
- Meta Omnilingual ASR: https://huggingface.co/facebook/omniASR-LLM-7B; MMS: https://huggingface.co/facebook/mms-1b-all
- NVIDIA Canary-1b-v2: https://huggingface.co/nvidia/canary-1b-v2; Parakeet v3: https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3
- Gemma 3n: https://huggingface.co/google/gemma-3n-E4B-it; Voxtral: https://huggingface.co/mistralai/Voxtral-Mini-3B-2507; Qwen3-ASR: https://huggingface.co/Qwen/Qwen3-ASR-1.7B
- Silero VAD: https://github.com/snakers4/silero-vad; pyannote community-1: https://huggingface.co/pyannote/speaker-diarization-community-1
- IndicVoices: https://huggingface.co/datasets/ai4bharat/IndicVoices; Svarah: https://arxiv.org/pdf/2305.15760; Lahaja: https://huggingface.co/datasets/ai4bharat/Lahaja; Vaani benchmark paper: https://arxiv.org/pdf/2606.21408
- Code-mix-aware WER:
  - SN-WER: https://arxiv.org/pdf/2606.02548
  - T-WER: https://arxiv.org/pdf/2203.16578
  - toWER: https://research.google/pubs/transliteration-based-approaches-to-improve-code-switched-speech-recognition-performance/
  - Orthography-aware evaluation: https://arxiv.org/html/2603.00941v1

**LLMs and vision**
- Sarvam-30B (MoE config, MILU table, serving): https://huggingface.co/sarvamai/sarvam-30b; Sarvam-105B: https://huggingface.co/sarvamai/sarvam-105b
- Sarvam 30B/105B launch blog: https://www.sarvam.ai/blogs/sarvam-30b-105b; Sarvam-105B docs: https://docs.sarvam.ai/api-reference-docs/models/sarvam-105b
- Sarvam 30B/105B press coverage: https://www.businesstoday.in/tech-today/story/sarvam-ai-launches-30b-and-105b-open-source-models-516729-2026-02-18
- Sarvam-M: https://huggingface.co/sarvamai/sarvam-m; Sarvam-Translate: https://huggingface.co/sarvamai/sarvam-translate; Sarvam-1: https://huggingface.co/sarvamai/sarvam-1
- Sarvam Vision: https://www.sarvam.ai/blogs/Sarvam-vision and https://www.sarvam.ai/blogs/sarvam-vision-2-1
- Krutrim-2: https://huggingface.co/krutrim-ai-labs/Krutrim-2-instruct; Chitrarth: https://huggingface.co/krutrim-ai-labs/Chitrarth
- BharatGen Param2: https://huggingface.co/bharatgenai/Param2-17B-A2.4B-Thinking; Param-1: https://arxiv.org/abs/2507.13390
- IndicTrans2 / IN22: https://github.com/AI4Bharat/IndicTrans2
- Bodhan IndicOCR (handwriting table, vLLM throughput): https://huggingface.co/bodhan-ai/indic-doc-parser
- Qwen3.5-27B (architecture, 262K, Apache-2.0, OCRBench): https://huggingface.co/Qwen/Qwen3.5-27B; Qwen3 blog: https://qwenlm.github.io/blog/qwen3/
- Qwen3-VL-8B: https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct; printed-Hindi OCR preprint: https://www.emergentmind.com/papers/2606.29213
- Gemma 4: https://huggingface.co/google/gemma-4-31B-it and https://datanorth.ai/news/google-releases-gemma-4-open-models
- gpt-oss-20b: https://huggingface.co/openai/gpt-oss-20b; gpt-oss-120b: https://huggingface.co/openai/gpt-oss-120b
- Mistral Small 3.2: https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506; Llama 4 Scout: https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E-Instruct
- PaddleOCR-VL: https://huggingface.co/PaddlePaddle/PaddleOCR-VL
- MILU benchmark paper: https://arxiv.org/html/2411.02538; IndicVisionBench: https://arxiv.org/html/2511.04727v1; BhashaSutra survey: https://arxiv.org/pdf/2604.18423
- JSONSchemaBench (structured-output reliability): https://arxiv.org/html/2501.10868
- Indic-COMET / IndicMT Eval: https://github.com/ai4bharat/indicmt-eval
- LLM–human grading agreement review (QWK 0.30–0.80): https://arxiv.org/abs/2512.14561
- MCQ distractor evaluation examples: https://arxiv.org/pdf/2404.02124 and https://arxiv.org/abs/2307.16338v1

**Serving, GPUs, prices**
- vLLM structured outputs: https://docs.vllm.ai/en/latest/features/structured_outputs.html; supported models: https://docs.vllm.ai/en/latest/models/supported_models/
- vLLM quantization: https://docs.vllm.ai/en/latest/features/quantization/; online serving: https://docs.vllm.ai/en/latest/serving/online_serving/
- vLLM gpt-oss recipe: https://docs.vllm.ai/projects/recipes/en/latest/OpenAI/GPT-OSS.html
- SGLang structured outputs: https://docs.sglang.io/advanced_features/structured_outputs.html
- TGI (archived): https://github.com/huggingface/text-generation-inference
- llama.cpp server: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md; Ollama structured outputs: https://docs.ollama.com/capabilities/structured-outputs
- NVIDIA L4: https://www.nvidia.com/en-us/data-center/l4/; H100: https://www.nvidia.com/en-us/data-center/h100/; RTX 5090: https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/; L40S (Lenovo guide): https://lenovopress.lenovo.com/LP1812
- KV-cache sizing:
  - https://apxml.com/courses/designing-and-sizing-production-llm-infrastructure/chapter-3-inference-dynamics-attention/kv-cache-memory-scaling
  - https://lyceum.technology/magazine/llm-context-length-gpu-memory-requirements/
- Throughput data points (single-stream, third-party):
  - https://markaicode.com/benchmarks/vllm-qwen-3-rtx-5090-memory-benchmark/
  - https://computingforgeeks.com/?p=171658
  - https://www.edge-ai-vision.com/2024/10/accelerating-llms-with-llama-cpp-on-nvidia-rtx-systems/
- Sarvam pricing: https://www.sarvam.ai/api-pricing and https://docs.sarvam.ai/api-reference-docs/pricing.md
- OpenAI pricing: https://developers.openai.com/api/docs/pricing
- Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing
- E2E Networks: https://www.e2enetworks.com/pricing.md
- RunPod: https://www.runpod.io/pricing
- Lambda: https://lambda.ai/pricing
- Modal: https://modal.com/pricing
- AWS prices (aggregators):
  - https://www.devzero.io/instances/aws/g6.xlarge
  - https://www.devzero.io/instances/aws/g5.xlarge
  - https://compute.doit.com/spot/us-east-1/g6e.xlarge
- GCP L4 (aggregator): https://calculator.holori.com/gcp/vm/g2-standard-4/asia-south1
- IndiaAI Mission GPU rates (PIB):
  - https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/feb/doc2026210784401.pdf
  - https://www.pib.gov.in/PressReleasePage.aspx?PRID=2097709
- DPDP Rules 2025 overview (EY): https://www.ey.com/content/dam/ey-unified-site/ey-com/en-in/pdf/2025/11/ey-india-dpdp-act-2023-and-rules-2025-pov.pdf

**Fully local roadmap (§11)**
- Qwen3.8-27B (Apache-2.0, hybrid attention, 262K context, vision, Aug 2026): https://huggingface.co/Qwen/Qwen3.8-27B; Qwen3.8-Flash-Next (qwen-community-1.0 licence): https://huggingface.co/Qwen/Qwen3.8-Flash-Next; Qwen org listing: https://huggingface.co/Qwen
- Sarvam-30B context and vLLM status (evals at 65,536 tokens; vLLM hotpatch): https://huggingface.co/sarvamai/sarvam-30b
- vLLM request fields (`max_completion_tokens`, deprecated `max_tokens`, `chat_template_kwargs`, `structured_outputs`): https://docs.vllm.ai/en/latest/api/vllm/entrypoints/openai/chat_completion/protocol/
- vLLM `max_completion_tokens` precedence (PR #9837): https://app.semanticdiff.com/gh/vllm-project/vllm/pull/9837/overview
- XGrammar keyword soundness test (XGrammar 0.1.29, generated 2026-01-09; third-party, by dottxt): https://blog.dottxt.ai/json-schema-comparison.html
- XGrammar-2 (May 2026, vendor post): https://blog.mlc.ai/2026/05/04/xgrammar-2-fast-customizable-structured-generation; vLLM structured decoding intro: https://vllm.ai/blog/struct-decode-intro
- vLLM pooling / embedding models: https://docs.vllm.ai/en/latest/models/pooling_models.html; engine arguments (`--gpu-memory-utilization`): https://docs.vllm.ai/en/latest/configuration/engine_args.html
- bge-m3 (MIT, 8,192 tokens, 1,024 dims, dense + sparse + multi-vector): https://huggingface.co/BAAI/bge-m3
- multilingual-e5-large-instruct (MIT, 512 tokens): https://huggingface.co/intfloat/multilingual-e5-large-instruct
- Qwen3-Embedding-0.6B (Apache-2.0, 32K, MRL 32–1,024 dims, MTEB multilingual 64.33): https://huggingface.co/Qwen/Qwen3-Embedding-0.6B; 4B/8B figures (aggregator): https://dev.co/ai/llms/qwen3-embedding-0-6b
- Krutrim Vyakyarth (0.3B, 128 tokens, Krutrim Community License): https://huggingface.co/krutrim-ai-labs/Vyakyarth
- IndicBERTv2-SS (MIT, AIKosh listing): https://aikosh.indiaai.gov.in/home/models/details/ai4bharat_indicbertv2_ss_multilingual_sentence_similarity_model.html
- Indic embedding comparison (PI-Indic-Align, Jan 2026; E5-Large-Instruct vs BGE-M3): https://arxiv.org/abs/2601.10205v1
- pgvector v0.8.7 (limits, filtering, iterative scans, Docker tags): https://github.com/pgvector/pgvector
- PostgreSQL locale/collation changes when the C library changes: https://wiki.postgresql.org/wiki/Locale_data_changes
- Bodhan AI model list (indic-transcribe-flex/core, indic-ocr, indic-translate, indic-speak): https://huggingface.co/bodhan-ai
- Bodhan IndicOCR (printed 86.2 / handwriting 66.7, vLLM throughput): https://huggingface.co/bodhan-ai/indic-ocr
- Chandra OCR 2 (43-language table, licence thresholds): https://github.com/datalab-to/chandra
- Surya licence history (mirror README; thresholds differ by version): https://huggingface.co/pitapo/surya/blob/main/README.md and https://www.sourcepulse.org/projects/1869784
- PaddleOCR PP-OCRv5 multilingual (Devanagari, Tamil, Telugu models and accuracies): https://www.paddleocr.ai/latest/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html
- OmniHandwritingOCR (Aug 2026; Qwen3-VL-8B best aggregate): https://arxiv.org/pdf/2608.18586; IndicPage-OCR (handwritten hi/bn/ta/te): https://cvit.iiit.ac.in/images/ConferencePapers/2026_01/IndicPage-OCR.pdf
- Tamil/Sinhala zero-shot OCR comparison (incl. Surya): https://arxiv.org/html/2507.18264v2
- Bodhan indic-speak (TTS, 3.78B, 95 preset voices, ~200 ms first audio): https://huggingface.co/bodhan-ai/indic-speak
- Indic Parler-TTS (Apache-2.0, 0.9B, 69 speakers): https://huggingface.co/ai4bharat/indic-parler-tts; IndicF5 (MIT, 0.4B, needs reference audio): https://huggingface.co/ai4bharat/IndicF5
- Bodhan indic-translate (7.94B, Gemma-4-E4B base, IN22 chrF++ vs IndicTrans2): https://huggingface.co/bodhan-ai/indic-translate
- Qwen3Guard-Gen (Apache-2.0, 0.6/4/8B, 119 languages): https://huggingface.co/Qwen/Qwen3Guard-Gen-8B and https://arxiv.org/abs/2510.14276v1
- gpt-oss-safeguard-20b (Apache-2.0, policy-based classifier): https://huggingface.co/openai/gpt-oss-safeguard-20b/blob/main/README.md
- pyannote community-1 vs precision-2 (hosted): https://huggingface.co/pyannote/speaker-diarization-community-1

**ClassPulse internal**
- `docs/HANDBOOK.md` §3 and §8
- `apps/api/src/pipeline/{providers,llm,openaiStt,types}.ts`
- `apps/api/src/config/env.ts`
- `packages/shared/src/settings.ts`
- §11: `apps/api/src/modules/resources/{grounding,voice,queue}.ts`, `modules/resources/generators/{common,lessonPlan,worksheet,questionPaper,presentation}.ts`, `modules/curriculum/{draftSummary,extract}.ts`, `modules/assignments/grading.ts`, `modules/lessons/analytics.ts`, `packages/shared/src/teacher-tools.ts`, `infra/docker-compose.*.yml`

---

## 11. Fully local roadmap (every AI feature)

**Owner's goal (2026-10-11).** ClassPulse should eventually call **no external AI API**. Today it calls OpenAI (chat and `whisper-1`) and Sarvam (STT). Bigger models are acceptable where quality needs them. API cost still matters until the GPUs arrive.

This section extends §3–§9 to the features shipped after the first draft:
- teacher tools (lesson plans, worksheets, question papers, presentations);
- voice prompts;
- unit summary drafting;
- remedial plans;
- Bloom/competency tagging;
- material ingestion.

It does not repeat the evidence above. It uses the same labels: **(calc)**, **(est.)** and **UNVERIFIED**.

**How the code calls AI today** (read from the repo, 2026-10-11):
- **One `chat()` function for every text and vision feature.** `chat()` in `pipeline/llm.ts` posts to `${OPENAI_BASE_URL}/chat/completions` with `response_format: {type: "json_schema", json_schema: {name, strict: true, schema}}` and `max_completion_tokens`. It sends no temperature.
- **One shared generator for the teacher tools.** All four go through `generateStructured()` in `generators/common.ts`: strict schema, then zod, then semantic `check`, then **one repair round**, then optional deterministic fixes.
- **Queued versus synchronous.** Lesson jobs and resource jobs run on BullMQ queues (`jobs/queue.ts`, `modules/resources/queue.ts`). Voice prompts, grading suggestions and summary drafts are synchronous requests.
- **Voice prompts** call Sarvam's synchronous REST endpoint (`saaras:v3`, codemix) with a 60 s audio limit, or OpenAI transcription if the school chose OpenAI (`modules/resources/voice.ts`).
- **Grounding** packs unit summaries (at most ¼ of the budget), lesson transcripts and teacher materials into **60,000 characters** (`resources/grounding.ts`). Materials are extracted with unpdf or mammoth and capped at 200,000 characters (`curriculum/extract.ts`). Scanned PDFs yield no text and are rejected.
- **Grading** sends the submission text plus up to **4 photos** (JPEG/PNG) as image inputs (`assignments/grading.ts`).
- **Bloom level and competency** are fields inside the quiz and question-paper schemas, not separate calls.

### 11.1 Feature-by-feature table

All latencies are single requests on one L40S, model already loaded, and are **(est.)**. They assume:
- a dense 27B model at 4-bit decodes at about 35–45 tokens/s;
- the same model at FP8 decodes at about 20–30 tokens/s (both calc from 864 GB/s bandwidth, discounted);
- an MoE model with ~3B active parameters decodes at about 100+ tokens/s.

Output sizes come from the generators' `maxTokens` (§11.8).

| Feature | Today | Local primary → fallback | GPU memory (incremental) | Latency (est.) | Risk | Notes |
|---|---|---|---|---|---|---|
| **Lecture STT** | Sarvam `saaras:v3` codemix (or `whisper-1`) | `indic-transcribe-flex` (mixed-script) → `indic-conformer-600m` / `SraVaani-1.0` (MIT) for Indic, faster-whisper large-v3 for en-IN | ~9 GB (vendor: 9.2 GiB batched) | 60-min lecture: ~1–3 min (vendor 77× real time, GPU not stated) | Medium: licence, classroom accuracy | §3, §7. Biggest cost item; migrates first. |
| **Voice prompts** (≤60 s, any language, code-mixed) | Sarvam synchronous, `saaras:v3` codemix | Same flex model, priority lane → faster-whisper large-v3-turbo (en-IN, Hindi) | 0 (shared with lecture STT) | ~1–2 s for 60 s audio | Low–Medium | §11.5. Teacher sees and edits the text, so small errors are tolerable. |
| **Quiz** (+ summary, takeaways, assignment, Bloom/competency tags) | `gpt-4.1-mini` (school's `llmModel`), strict json_schema | Qwen3.5-27B or Qwen3.8-27B → Qwen3.5-35B-A3B (speed) or Sarvam-30B (Indic tokenizer) | 4-bit: ~16 GB + 8–12 GB KV cache; FP8: ~28 GB + KV (calc) | Bilingual 20 questions (cap 16k tokens): dense ~4–7 min, MoE ~1.5–2.5 min | Medium: speed, Indic fluency | Today ~21 s. Thinking off. §7 thresholds apply. |
| **Lesson plan** | `gpt-4.1-mini` | Same LLM | 0 (shared) | 1 period (cap 6.5k): dense ~2–3 min, MoE ~40–60 s | Low–Medium | Queued job, so minutes are tolerable with a progress state. Timing-sum check stays. |
| **Worksheet** | `gpt-4.1-mini` | Same LLM | 0 | 10 items (cap 5.5k): dense ~1.5–2.5 min | Low–Medium | Item-count tolerance (≥60%) already exists. |
| **Question paper** (marks, Bloom, competency, internal choice, answer key) | `gpt-4.1-mini` | Same LLM, **one call per section in parallel** → bigger model (Sarvam-105B / gpt-oss-120b on H100) if answer keys fail | 0 (more KV while sections run in parallel) | 80 marks (~16k tokens): one call ~6–10 min dense; split ~2–3 min | **Medium–High**: length, answer-key correctness, marks arithmetic | Already at the 16k cap on the API (§11.2). |
| **Presentation** (slides + speaker notes) | `gpt-4.1-mini` | Same LLM; outline call, then slide batches of ≤10 in parallel | 0 | 10 slides + notes (cap 6k): ~2–3 min; 40 slides need splitting | Low–Medium | 40 slides with notes would need 19.5k tokens, above the 16k cap. |
| **Unit summary draft** | `gpt-4.1-mini` | Same LLM | 0 | Cap 1.5k: ~30–60 s dense, ~15 s MoE | Low | Teacher edits before saving. |
| **Remedial plan** (from quiz analytics) | `gpt-4.1-mini` | Same LLM | 0 | Cap 2.5k: ~1 min dense | Low | English output; aggregated numbers only, so little personal data. |
| **Grading suggestions** (text + up to 4 photos) | `gpt-4.1-mini` with image inputs | Same VLM (Qwen3.5/3.8-27B read images) → two-step: IndicOCR, then text LLM | 0 (VLM) or ~3 GB (OCR) | Cap 2k: ~1–1.5 min dense, plus image prefill | Typed answers: Medium. **Indic handwriting: High** | §4.3. Teacher review stays mandatory. |
| **Scanned PDFs** (material ingestion) | Rejected (unpdf finds no text) | `bodhan-ai/indic-ocr` → resident VLM page-by-page; CPU stopgap: PaddleOCR PP-OCRv5 (printed hi/mr/ta/te/en only) | ~2–4 GB (0.8B + 33M models, est.) | ~0.5–3 s/page single stream (vendor: 5–6 pages/s at high concurrency on an H100) | Medium | §11.4. New capability; no API fallback to keep. |
| **Grounding retrieval** (new) | None: truncate at 60k chars | `bge-m3` → `multilingual-e5-large-instruct` or `Qwen3-Embedding-0.6B`; pgvector in our Postgres | ~1.5–2 GB, or CPU | <0.1 s per query; seconds per document at ingestion | Low | §11.3. Fallback is today's truncation. |

**Model naming.** The Bodhan Hugging Face org now lists the OCR model as **`bodhan-ai/indic-ocr`**. It has the same design (33M layout model + 0.8B OCR model on Qwen3.5-0.8B) and the same scores (handwriting 66.7, printed 86.2) as the `indic-doc-parser` cited in §4.3. Treat them as one model, but use the current repo id.

**New LLM since the first draft.** **Qwen3.8-27B** was released on Hugging Face on 14 Aug 2026 under Apache-2.0. It has the same hybrid-attention design as Qwen3.5-27B, 262K context, vision, OmniDocBench 1.5 of 91.1 and IFBench 79.5. Its card lists **no multilingual or Indic numbers**, and thinking is on by default. Benchmark it next to Qwen3.5-27B as a drop-in; the memory need is the same (calc). The larger Qwen3.8-Flash-Next (180B total, 6B active) uses a custom `qwen-community-1.0` licence and needs ~360 GB in BF16 (calc), so it is out of scope.

### 11.2 Structured output with local LLMs

**What carries over unchanged**
- **The request shape.** vLLM accepts the same `response_format: {type: "json_schema", json_schema: {...}}` request and enforces it with a grammar backend (XGrammar or Guidance; default `auto`).
- **Token limits.** `max_completion_tokens` is a supported vLLM field and takes precedence over the deprecated `max_tokens`. That resolves the §7.5 question for current vLLM. Older builds rejected it.
- **Usage counts.** `usage` is returned, so `ai_usage` tracking keeps working. Record `provider: 'local'`.
- **Our schemas are a safe subset.** They use objects with every property required and `additionalProperties: false`, arrays, strings, integers, booleans and **string-only enums** (difficulty, Bloom level, question type). There is no `oneOf`, `pattern`, numeric bounds or `$ref` recursion. Numbers like marks and timings are checked in zod and in `check`, not in the schema.

**What vLLM does not document**
- **`strict`.** The vLLM docs never mention the `strict` flag. The grammar applies whenever `json_schema` is sent. Whether `strict: false` relaxes anything is **UNVERIFIED**, and it does not matter for us.
- **`refusal`.** That vLLM fills `message.refusal` is **UNVERIFIED** (believed not). A local refusal will arrive as schema-valid but empty or useless content, which our validators already reject.

**Where XGrammar is unsound.** A third-party test of XGrammar 0.1.29 (generated 2026-01-09) found:

| Status | Keywords |
|---|---|
| Unsound | `enum` (with mixed-type values), `const`, `pattern`, numeric `minimum`/`maximum`, `additionalProperties` (accepted an extra key in one case), `oneOf` |
| Supported | `minItems`/`maxItems`, `required`, `anyOf`, `$ref`/`$defs`, `minLength`/`maxLength` |

**Consequences:**
1. Keep zod parsing and `check` on every response, even though the grammar "guarantees" the schema. Zod already strips unknown keys.
2. If a schema misbehaves, switch the backend to Guidance (`--structured-outputs-config.backend guidance`). It scored best on the hard schemas in JSONSchemaBench (§4.4).
3. **A local-only improvement to test:** add `minItems = maxItems = N` for exact counts (questions per section, slides per batch, worksheet items). XGrammar supports these keywords, so counts become structural and fewer repair rounds are needed. The risk is that a forced count pushes the model into filler items, which the teacher rating would catch. Whether OpenAI's strict mode accepts these keywords is UNVERIFIED, so build the local schema variant separately.

**What breaks, and the fix**

| Problem | Fix |
|---|---|
| **Thinking models.** Qwen3.5/3.8 think by default. Without a reasoning parser, the thinking text can collide with the grammar; vLLM warns structured outputs "might become disabled" for some reasoning models. | Send `chat_template_kwargs: {enable_thinking: false}` (Qwen) or low reasoning effort (gpt-oss), and run vLLM with the matching `--reasoning-parser`. `chat()` reads only `message.content`, which is correct. |
| **Runaway output.** Some models under grammar constraints emit whitespace or repeat until the token limit (UNVERIFIED for our models). `parseJsonContent` then reports "truncated, keep it shorter", which is the wrong diagnosis. | Locally, treat a truncated reply that is mostly whitespace or repetition as a loop. Retry once with a presence penalty (Qwen's own non-thinking recommendation is `presence_penalty: 1.5`) and log it. |
| **Grammar compile time.** Each new schema is compiled once, and the question-paper schema changes per request. | XGrammar caches compiled grammars, and the cost is tens to hundreds of ms (vendor claims). Measure it; it should be negligible next to generation time. |
| **Image `detail` field.** | Ignored by vLLM (§7.5); harmless. |

**Long outputs and token budgets.** Several requests **already reach the 16,000-token cap on the API**, computed from the `maxTokens` formulas:

| Request | Formula (cap 16,000) | Example |
|---|---|---|
| Quiz, bilingual | 2,500 + 900 × questions | 20 questions → 20,500 → **capped** |
| Lesson plan | 5,000 + 1,500 × periods | 1 period → 6,500; ≥8 periods → capped |
| Worksheet | 2,000 + 350 × items | 10 items → 5,500; ≥40 items → capped |
| Presentation (with notes) | 1,500 + 450 × slides (220 without notes) | 10 → 6,000; 40 → 19,500 → **capped** |
| Question paper | 1,500 + Σ count × per-type tokens × (1.8 if internal choice) | Standard 80-mark CBSE pattern (A 20×1 MCQ, B 5×2, C 6×3, D 4×5 with choice, E 3×4 case-based) → ~16,400 → **capped** |
| Unit summary / remedial / grading | 1,500 / 2,500 / 2,000 | — |

The caps are ceilings; real outputs are usually smaller (est. 60–80%). Two things change locally:
1. **The cap is no longer the limit; time is.** Qwen3.5/3.8 accept 262K tokens, but a dense 27B decodes about 16k tokens in 6–12 min single-stream (calc). The fix is to **split long jobs into parallel calls**:
   - question paper: one call per section;
   - presentation: one outline call, then slide batches of ≤10;
   - lesson plan: one call per period when there are more than 4 periods.

   vLLM batches parallel requests almost for free (decoding is memory-bandwidth-bound), so wall time is close to the longest part (est.). The split also shrinks the blast radius of a repair round. It helps on the API path too.
2. **Indic outputs cost more tokens.** Qwen and Gemma tokenizers likely spend more tokens per Indic word than Sarvam's Indic-optimised tokenizer (UNVERIFIED magnitude). Measure **output tokens per 1,000 characters** per language and model (§11.9). This is the main argument for keeping Sarvam-30B on the shortlist for Indic-heavy long outputs.

**The repair round stays, with one transition rule.** With grammar-constrained decoding, schema-invalid replies should drop to about zero. Repair rounds then fix only semantic issues: counts, marks totals, Bloom mix, timing sums. During the transition (`local_then_api`, §11.7):
- round 1 and the repair round run locally;
- if the result is still invalid, make **one** API call with the **original** messages (not the repair conversation) and record `fallbackFrom: 'local'`.

The deterministic fixes (`acceptIssues`, marks renumbering) are unchanged.

### 11.3 Grounding and retrieval (RAG) going local

**Today:** the 60,000-character packing works and fits every shortlisted model:
- 60k Indic characters is ~30k tokens (est.);
- Qwen3.5/3.8-27B: 262K; Gemma 4 31B: 256K; Sarvam-105B: 128K; gpt-oss: 128K (UNVERIFIED);
- Sarvam-30B states no maximum (its evals ran at 65,536 tokens).

**Context length is therefore not the reason to add retrieval.** The real reasons are:
1. **Silent truncation.** A unit with several long materials (each up to 200k characters) loses everything past the budget, often the later chapters.
2. **Prefill time and KV memory** grow with every token sent. Locally, that cost is paid in GPU time.
3. **Cross-unit features**, such as a term-end paper over six units, or later "ask the syllabus", cannot fit everything.

**Recommendation: hybrid, not replacement.**
- Always include unit summaries and objectives, as today.
- Fill the remaining budget with the top-k chunks retrieved for the teacher's request and units, instead of the first N characters.
- Fall back to today's truncation if the embedding service is down.

**Embedding candidates** (all self-hostable)

| Model | Size / context / dims | Licence | Indic evidence | Verdict |
|---|---|---|---|---|
| **BAAI/bge-m3** | ~568M (XLM-R large, UNVERIFIED on card) / **8,192 tokens** / 1,024 | **MIT** | 100+ languages. Best reverse-retrieval R@1 (32.1%) in a Jan 2026 12-language Indic comparison (persona-matching task, not documents). | **Primary.** Long chunks, and it can also produce sparse (lexical) vectors, which help with English technical terms inside Indic text. |
| intfloat/multilingual-e5-large-instruct | ~560M / **512 tokens** / 1,024 | MIT | Best monolingual R@1 (27.4%) in the same comparison | Fallback; short chunks only. |
| Qwen/Qwen3-Embedding-0.6B (also 4B, 8B) | 0.6B / 32K / up to 1,024 (MRL 32–1,024); 4B: 2,560; 8B: 4,096 | Apache-2.0 | MTEB multilingual 64.33 (0.6B); 69.45 / 70.58 for 4B / 8B (aggregator). No Indic breakdown. | Test as an alternative. The 8B's 4,096 dims exceed pgvector's 2,000-dim HNSW limit, so it would need `halfvec` or truncation. |
| krutrim-ai-labs/Vyakyarth | 0.3B / **128 tokens** / 768 | Krutrim Community License | Strong on IndicXtreme Flores sentence retrieval (self-reported) | Too short for document chunks; custom licence. Not recommended. |
| ai4bharat IndicBERTv2-SS | — | MIT (AIKosh) | Sentence similarity | Not trained for retrieval; skip. |
| Sarvam / Bodhan | No open embedding model found (Bodhan's org lists STT, OCR, translation and TTS only) | — | — | — |

**pgvector in our Postgres 16**
- pgvector **0.8.7** supports Postgres 13+. HNSW and IVFFlat index up to 2,000 dims for `vector` and 4,000 for `halfvec`. Iterative index scans (0.8+) help filtered queries.
- **Our scale does not need an ANN index at first.** For example, 200 materials × 200k characters is ~40k chunks of ~1,000 characters per school (est.). An exact search filtered by `institution_id` and `unit_id`, using B-tree indexes, is fast enough. It also avoids pgvector's documented problem that HNSW applies filters *after* the scan, which hurts recall and lets one tenant affect another.
- **Image change: watch the collation.** We run `postgres:16-alpine`, and the ready-made image is `pgvector/pgvector:pg16` (Debian). Moving an existing data directory from musl (Alpine) to glibc (Debian) can break text B-tree indexes when the database uses a libc locale. Check `datcollate` first. Then either:
  - build pgvector into our Alpine image (it compiles from source; a small Dockerfile), or
  - switch images and `REINDEX` the text indexes (or dump and restore).

  Note that logical dumps are unaffected.
- **Chunking.** Use ~800–1,200 tokens per chunk, store the page number or transcript block index for citations, and re-embed only when a material changes (a background job on the existing BullMQ setup).

**Serving.** vLLM serves embedding models with its pooling runner on an OpenAI-compatible `/v1/embeddings` endpoint (Qwen3-Embedding needs vLLM ≥0.8.5). bge-m3 is also cheap enough to run on CPU for ingestion (est.), which keeps GPU memory free.

### 11.4 OCR for scanned PDFs and handwritten answer sheets

| Option | Printed Indic | Handwriting | Licence | Notes |
|---|---|---|---|---|
| **bodhan-ai/indic-ocr** (layout 33M + OCR 0.8B) | English + **22** Indian languages. Word accuracy 86.2, close to Sarvam Vision's 86.6 (self-reported). | English + **12** Indian languages, 66.7 overall (Gemini 3.1 Pro: 72.0); "work in progress" | Indic Open Model License (same approval clause as the STT models) | Outputs reading-ordered Markdown with tables and LaTeX. Served with vLLM; 5–6 pages/s on an H100 at high concurrency. |
| Chandra OCR 2 (Datalab) | Strong on the vendor's 43-language table: ta 77.7, hi 78.4, bn 72.8, mr 75.0, gu 70.8, ml 64.3, kn 63.2, te 58.6 | "Excellent" (vendor claim; no Indic handwriting numbers) | Code Apache-2.0; **weights under a modified OpenRAIL-M**: free under $2M funding/revenue, no use that competes with Datalab's API, commercial licence above that | Good quality, but the licence becomes a problem as we grow. Second choice only. |
| Surya (Datalab) | Multilingual; no Indic numbers found (beaten by Google Document AI on Tamil in one 2025 study) | Not claimed | Same Datalab weight licence family; thresholds differ by version ($2M or $5M) | Superseded by Chandra; skip. |
| PaddleOCR PP-OCRv5 | **Only** Devanagari (hi, mr: 84.96), Tamil (94.2) and Telugu (87.65), measured on Paddle's own sets. **No** kn, ml, bn, gu, pa, or. | Not documented | **Apache-2.0** | Small and CPU-capable: a **pre-GPU stopgap** for printed scans in 4 of our languages. ARM64 (OCI) support is UNVERIFIED. |
| docTR (Mindee) | No official Indic vocabularies (only community forks) | No | Apache-2.0 | Excluded. |
| Qwen3.5-27B / Qwen3.8-27B (resident VLM) | General OCR is strong (OCRBench 89.4; OmniDocBench 1.5 91.1); **no Indic numbers** | Qwen3-VL-8B had the best aggregate in OmniHandwritingOCR (Aug 2026), but there is no Indic breakdown | Apache-2.0 | Zero extra memory, since it is already loaded for grading. |

**Recommendation: `bodhan-ai/indic-ocr` as the single OCR model**, for scanned PDFs and handwritten answer photos alike.
- It is the only open model with **measured** Indic handwriting results across most of our languages.
- It is small (~2 GB of weights) and runs on vLLM.
- The resident Qwen VLM is the fallback (prompt: "transcribe this page exactly"). PaddleOCR is the CPU stopgap before GPUs, printed hi/mr/ta/te/en only.
- **This depends on the same Bodhan licence confirmation** as STT (§1 risk 1). If Bodhan says no, use the VLM fallback for everything and benchmark Chandra under its licence.

**For grading, compare one-step and two-step on the same photos** (already in §7.2):
- **Two-step** (OCR, then a text LLM): the teacher can see what was read, and OCR error can be measured on its own.
- **One-step** (the VLM grades the photo directly): simpler, but its reading cannot be inspected.

### 11.5 Short-form STT for voice prompts

**Target:** under 3 s from upload to text for 60 s of audio.

- **The same model as lecture STT works.** `indic-transcribe-flex` accepts up to 45 s per call. A 60 s prompt becomes two VAD chunks sent as one batch. At the vendor's 77× real time, 60 s of audio is ~0.8 s of compute (calc; GPU not stated). With ffmpeg conversion and network time, that is about 1–2 s end to end (est.).
- **It must stay loaded.** Cold-loading a 1.2B NeMo model takes seconds (est.), so the STT sidecar is always on.
- **Contention with lecture jobs is the real risk.** A lecture batch can saturate the GPU, so:
  1. the sidecar serves short requests from a **priority lane** (a separate small worker, or chunk-level interleaving so a lecture never holds the GPU for more than one chunk batch);
  2. lecture jobs run with concurrency 1–2, or overnight;
  3. the API applies a local timeout of ~4 s, then falls back to Sarvam during the transition.
- **Language hint.** Pass the teacher's UI or resource language to the sidecar. Whether Indic-Transcribe auto-detects the language reliably on 5–10 s clips is UNVERIFIED.
- **Fallbacks:**
  - `faster-whisper large-v3-turbo` for en-IN and Hindi (MIT, ~3–6 GB, fast), but it writes Indic words in one script, so codemix quality drops;
  - IndicConformer (MIT) for Indic-only prompts.

### 11.6 Possible upcoming features (plan locally from day one)

| Feature | Local candidate(s) | Size / memory | Licence | Notes |
|---|---|---|---|---|
| **TTS: read-aloud, accessibility** | 1. **ai4bharat/indic-parler-tts**: 21 listed languages (Punjabi "unofficial"), 69 named speakers, style set by text captions<br>2. **bodhan-ai/indic-speak**: English + 22 languages (13 production-grade), 95 preset voices, ~200 ms to first audio, no voice cloning<br>3. ai4bharat/IndicF5: 11 languages incl. all 10 of our Indic ones | 1: 0.9B (~2–4 GB)<br>2: 3.78B (~8 GB BF16, calc)<br>3: 0.4B | 1: **Apache-2.0** (gated)<br>2: Indic Open Model License<br>3: MIT | IndicF5 needs a **reference voice clip** (voice cloning), which brings consent issues. Prefer preset voices. Generate audio once per resource and cache it in storage; it is not latency-critical. |
| **Translation** (whole worksheet or paper into another language; bilingual fields) | 1. **IndicTrans2** (1B, distilled 200–320M)<br>2. **bodhan-ai/indic-translate** | 1: <2–4 GB<br>2: 7.94B (the card says 24 GB minimum; 40 GB+ for 32k-token documents) | 1: MIT<br>2: Indic Open Model License | On IN22-Gen chrF++, IndicTrans2 is slightly ahead sentence by sentence (en→Indic 48.6 vs 47.7). indic-translate is much stronger at **document level** against Sarvam-Translate (69.4 vs 58.0, self-reported). Its card now lists 7.94B parameters, not the 4B in §4.1. Or just use the main LLM. |
| **Plagiarism / similarity** between submissions | Text shingles + MinHash for copying (no model); **bge-m3** embeddings for paraphrase and cross-language copies | Reuses the embedding service | — | Do **not** add "AI-written" detectors; they are unreliable and unfair to students. Show similarity to the teacher as a hint, never as a verdict. |
| **Speaker diarisation** (teacher vs students in lectures) | pyannote `speaker-diarization-community-1` | Small; runs on CPU or GPU | CC-BY-4.0 (gated) | The better `precision-2` model is hosted-only, so don't use it. The main use is dropping student chatter before quiz generation. |
| **Content safety** (student free text, any future chat, generated content for minors) | 1. **Qwen3Guard-Gen** 0.6B/4B/8B: 119 languages; Safe / Controversial / Unsafe across 9 categories; streaming variants exist<br>2. **gpt-oss-safeguard-20b**: applies a policy we write | 1: 4B ≈ 8 GB BF16 (calc); 0.6B ≈ 1.2 GB<br>2: fits 16 GB | Both Apache-2.0 | No Indic-specific safety results found; build a small labelled test set (§11.9). |

### 11.7 Serving topology and switching

**One GPU box (1× L40S 48 GB).** Tight, but it works if the LLM is 4-bit or MoE.

| Process | Model | Memory (calc/est.) |
|---|---|---|
| vLLM: LLM + vision | Qwen3.5/3.8-27B 4-bit (AWQ/GPTQ) **or** Qwen3.5-35B-A3B 4-bit | ~16–20 GB weights + ~8–12 GB KV cache (`--gpu-memory-utilization ≈ 0.6`) |
| STT sidecar | indic-transcribe-flex (+ Silero VAD on CPU) | ~9 GB |
| OCR (vLLM) | indic-ocr | ~2–4 GB; can be loaded on demand for batch ingestion |
| Embeddings | bge-m3 | ~2 GB, or CPU |
| CUDA contexts and headroom | — | ~1 GB per process (est.) |
| **Total** | | **~40–47 GB** of 48 GB |

- Several vLLM instances can share one GPU: `--gpu-memory-utilization` is a per-instance fraction.
- vLLM's `--enable-sleep-mode` can park a model to swap OCR or TTS in overnight; its behaviour with our models is UNVERIFIED.
- FP8 27B (~28 GB plus KV) does **not** fit comfortably next to STT on one card.
- TTS and content safety would not be co-resident on this box.

**Two GPU boxes (the comfortable target)**

| Box | GPU | Runs | Why |
|---|---|---|---|
| **A: LLM** | L40S 48 GB (or H100 80 GB later) | Qwen3.5/3.8-27B **FP8** with a large KV cache for parallel section and slide calls; on an H100, optionally Sarvam-105B or gpt-oss-120b for question papers | Generation never competes with audio. Can be rented on a school-hours schedule. |
| **B: speech and documents** | L4 24 GB | STT (~9 GB) + OCR (~3 GB) + embeddings (~2 GB) + later TTS (Indic Parler, ~3 GB) or Qwen3Guard-4B (~8 GB) | Voice prompts get predictable latency. Cheap to run always-on (₹49/hr at E2E). |

**Queueing.** BullMQ is already in place:
- **Give each GPU resource its own queue and concurrency cap**, matched to what the server can batch:
  - `gpu-stt-long`: concurrency 1–2;
  - `gpu-llm`: 4–8;
  - `gpu-ocr`: 2.

  Today the lesson job does STT and quiz generation in one job (`GENERATION_CONCURRENCY`). With two boxes, split it into two stages so a busy LLM does not hold an STT slot, and the reverse.
- **Use BullMQ priorities:**
  1. interactive (grading suggestion, summary draft);
  2. teacher resources;
  3. lecture quiz;
  4. bulk (re-embedding, OCR backfill, overnight lecture STT).
- **Voice prompts stay synchronous** (no queue), behind a small in-process semaphore and the 4 s local timeout.

**Switching per feature, with automatic API fallback.** This extends §8. It uses the `*_BASE_URL` naming of §8 and `OPENAI_BASE_URL`, so `LOCAL_LLM_URL` from the brief becomes `LOCAL_LLM_BASE_URL`.

```dotenv
# Endpoints on the GPU host(s), reached over a private network (WireGuard/Tailscale), never public
LOCAL_LLM_BASE_URL=http://gpu-a:8000/v1        # vLLM, OpenAI-compatible
LOCAL_LLM_API_KEY=...
LOCAL_LLM_MODEL=qwen3.5-27b                     # served model name
LOCAL_LLM_MODEL_LONG=                           # optional bigger model for question papers (e.g. on an H100)
LOCAL_VLM_BASE_URL=                             # empty = same as LOCAL_LLM_BASE_URL (grading photos)
LOCAL_STT_BASE_URL=http://gpu-b:9000/v1         # sidecar: /v1/audio/transcriptions, verbose_json
LOCAL_STT_API_KEY=...
LOCAL_EMBED_BASE_URL=http://gpu-b:8001/v1       # vLLM pooling: /v1/embeddings
LOCAL_EMBED_MODEL=bge-m3
LOCAL_OCR_BASE_URL=http://gpu-b:8002/v1         # indic-ocr (vLLM) or a small wrapper
LOCAL_TTS_BASE_URL=                             # later
LOCAL_TIMEOUT_MS=240000                         # long jobs; voice uses LOCAL_VOICE_TIMEOUT_MS
LOCAL_VOICE_TIMEOUT_MS=4000
LOCAL_FALLBACK_TO_API=true                      # global kill switch for fallback

# Per-feature route: api | local | local_then_api | shadow (API answers, local result stored for comparison)
AI_ROUTE_LECTURE_STT=local_then_api
AI_ROUTE_VOICE_STT=local_then_api
AI_ROUTE_QUIZ=shadow
AI_ROUTE_RESOURCES=shadow                        # lesson plan, worksheet, question paper, presentation
AI_ROUTE_SUMMARY=local_then_api
AI_ROUTE_REMEDIAL=local_then_api
AI_ROUTE_GRADING=api
AI_ROUTE_OCR=local                               # no API equivalent today
AI_ROUTE_EMBED=local                             # fallback is truncation, not an API
```

- **Where the settings live.** Endpoints and routes live in env, so ops can change them without a deploy. The per-school opt-in of §7.9 stays in Admin → AI settings and can only make a route *more* conservative (for example, force `api` for one school).
- **Fallback triggers:** connection error or timeout; the local health check (`GET /v1/models`) failing (a circuit breaker skips local for a few minutes); validator still failing after the local repair round (§11.2); suspicious STT output.
- **Logging.** Every fallback is logged with `fallbackFrom: 'local'` in `pipelineMeta` and `ai_usage`, so the fallback rate per feature is visible. That rate is the cut-over metric in §11.9.

### 11.8 Cost-aware interim guidance (until GPUs)

**Rough cost per use (est.).** Assumptions:
- Input is the full 60k-character grounding plus prompt: ~17k tokens for English, ~32k for Indic (est.).
- Output is the generator's `maxTokens` cap, so these are **upper bounds**; real outputs are usually 60–80% of that.
- Prices are from §2 at ₹88 = $1, without the cached-input discount.
- A repair round roughly doubles that use's cost.

| Use | Output cap | gpt-4o-mini | gpt-4.1-mini (default) | gpt-4.1 |
|---|---|---|---|---|
| Lesson plan (1 period) | 6,500 | ₹0.6–0.8 | ₹1.5–2.0 | ₹7.6–10.2 |
| 10-slide deck with notes | 6,000 | ₹0.5–0.7 | ₹1.4–2.0 | ₹7.2–9.9 |
| 80-mark question paper | 16,000 | ₹1.1–1.3 | ₹2.9–3.4 | ₹14–17 |
| Voice prompt (60 s) | — | Sarvam ₹0.50 (₹30/audio-hour) · `whisper-1` ₹0.53 · `gpt-4o-mini-transcribe` ₹0.26 | | |

`gpt-5-mini` costs about the same as gpt-4.1-mini before reasoning tokens, which add an unknown amount and make it slower. It is not worth it for these jobs.

**Monthly share, illustrative (est.).** Take one pilot school per month:

| Item | Assumption | Cost |
|---|---|---|
| Lecture STT | 100 lecture-hours | ₹3,000 |
| Lecture quizzes | same 100 lectures | ~₹300 |
| Teacher resources | 150 | ~₹300 |
| Grading suggestions | 400 | ~₹400 |
| Voice prompts | 300 | ~₹120 |
| **Total** | | **≈ ₹4,100** |

Lecture STT is about **70%** of that, the LLM features about 25%, and voice prompts about 3%.

**Guidance**
- **Stay on the cheapest model.** Use gpt-4.1-mini (or gpt-4o-mini) for remedial plans, unit summary drafts, worksheets, lesson plans and presentations:
  - the structure is enforced by our checks;
  - the teacher edits the output anyway;
  - these uses cost under ₹2 each.

  gpt-4o-mini is the cheapest. Note its 16,384-token output limit (gpt-4.1-mini allows 32,768), so it has no headroom for capped jobs.
- **Worth a bigger model** (gpt-4.1, as a per-feature override):
  - **question papers**: answer keys, marks arithmetic and internal choice; teachers make few per term, so ₹14–17 each is acceptable;
  - possibly **bilingual Indic quizzes**, if teacher ratings show gpt-4.1-mini's Tamil or Telugu is weak.

  Today `llmModel` is one setting per school. A per-feature override (`LLM_MODEL_QUESTION_PAPER=gpt-4.1`, or an AI-settings field) is the smallest change.
- **Not worth a bigger model yet: handwriting grading.** IndicVisionBench found GPT-4o weak at Indic OCR (§4.3), so paying for gpt-4.1 may not help. Measure it first.
- **Voice prompts: stay on Sarvam codemix.** `gpt-4o-mini-transcribe` costs half as much but loses Latin-script English terms. At about ₹0.5 per prompt, the saving is not worth it.
- **Cheap savings available now** (no quality change):
  - **Prompt-prefix caching.** `contextMessage()` in `generators/common.ts` currently puts the variable parts (title, task, teacher's request) *before* `SOURCE MATERIAL`. Moving the grounding block to the front of the user message would let repeated generations from the same unit hit OpenAI's cached-input price (75% off input). Locally, it would hit vLLM's prefix cache.
  - **Batch API (half price)** for anything not awaited, for example overnight re-generation.
  - **Splitting long jobs** (§11.2) also cuts repair-round cost.

### 11.9 Updated phased plan and benchmark additions

**Migration order** (by cost share, then quality risk):

| Phase | When | Features | Why this order |
|---|---|---|---|
| 0 | Now (no GPU) | Refactor `chat()` and the STT clients to take an endpoint (§8). Add per-feature routes (§11.7) and the gpt-4.1 override for papers (§11.8). Optionally add a PaddleOCR CPU stopgap for printed scans. Collect the new test sets below. Send licence emails to Bodhan (STT, OCR, TTS) and Datalab (only if Chandra is needed). | No GPU needed; de-risks everything after. |
| 1 | GPU weeks 1–3 | The §7 benchmark plus the additions below. The same models cover the new features, so the extra GPU time is small (est. +15–20 L40S hours). | — |
| 2a | After the §7.8 pass | **Lecture STT + voice prompts** → `local_then_api` | ~70% of spend (est.), and the privacy win. Voice is nearly free once the sidecar runs. |
| 2b | +2 weeks | **Short text jobs**: remedial plans, unit summaries → local; then worksheets and lesson plans | Low risk; the teacher edits the output. |
| 2c | +2–4 weeks | **Quizzes**, then **presentations and question papers** (with section and slide splitting) | Highest teacher visibility; long-output latency risk. |
| 2d | In parallel | **Embeddings + RAG** and **OCR for scanned PDFs** (local-only from day one) | New capabilities; the fallback is today's behaviour. |
| 2e | Last | **Grading** (typed first, handwriting per language once it passes) | Highest quality risk (§4.3). |
| 3 | After ≥4 weeks per feature with fallback rate <2% and no quality regression in weekly samples | Remove that feature's API route; finally remove the API keys | Cut-over is per feature, not big-bang. |

**Benchmark additions** (extend §7.3 and §7.4; same harness, same statistics)

| New test set | Content | Size |
|---|---|---|
| **E. Teacher tools** | Real units with uploaded materials (school board and college), 4 resource types × ta, hi, en + 2 other languages. Include the long cases: an 80-mark paper, a 40-slide deck with notes, an 8-period lesson plan. | ~30 units × 4 types × 2 runs ≈ 240 generations per model |
| **F. Voice prompts** | Teachers speaking requests (5–60 s) on phones, in classroom noise, all 11 languages, code-mixed, with reference text and term lists | ≥200 clips |
| **G. Scanned documents** | Scanned textbook and question-paper pages per language (printed), plus the 50 handwriting photos from §7.3 D | ≥10 pages per language |
| **H. Retrieval** | Teacher requests with the material chunks a teacher marks as relevant | ~100 queries |
| **I. Safety** (only if §11.6 safety is planned) | Labelled student texts (safe / unsafe) in 3+ languages | ~300 |

| New metric | How |
|---|---|
| Structural pass before repair | Share of resources whose counts, marks totals, slide counts and timing sums pass `check` on round 1; repair rate; **truncation rate** (`finish_reason: length`) |
| Teacher rating per resource | Use as is / minor edit / reject, plus 1–5 usefulness, blind against gpt-4.1-mini (§7.7 protocol; ~20 extra teacher-hours) |
| Paper answer-key correctness | Teacher yes/no per question on a sample (same bar as quizzes: ≥98%) |
| Output tokens per 1,000 characters | Per language and model; this predicts local generation time for Indic outputs |
| Wall time p50/p95 | Per resource type, single call vs split-parallel, at concurrency 1 and 4 |
| Voice STT | Script-normalised WER, technical-term recall, **end-to-end p95 latency ≤3 s while a lecture job is running** |
| OCR | CER/WER per language (printed and handwritten separately), pages/s |
| Retrieval | Recall@10 and nDCG@10 on set H; teacher "grounded" rating for RAG vs truncation on set E |
| Fallback rate | Per feature during shadow and hybrid runs (the Phase 3 cut-over metric) |

**Proposed extra pass thresholds** (adjust after the pilot):
- **Teacher tools:** structural pass after repair ≥98%, truncation ≤1%. Teacher "use as is or minor edit" no worse than gpt-4.1-mini by more than 5 points. p95 ≤ 3 min for a split 80-mark paper (queued job).
- **Voice:** p95 ≤3 s under load, and term recall ≥95% of Saaras.
- **OCR:** enable per language and per type (printed or handwritten) only after CER is reported and teachers judge the extracted text usable. The numeric bar is set after the first baseline.

**Open questions added by this section**
1. Does the Bodhan licence approval cover OCR and TTS as well as STT, in one letter?
2. How does Qwen3.8-27B perform on Indic generation? Its card publishes no multilingual numbers.
3. vLLM `strict` and `refusal` handling, and grammar loops with our schemas, on the exact vLLM version we pin.
4. What is the current Postgres collation (`datcollate`)? It decides whether pgvector means a custom Alpine build or an image switch with `REINDEX`.
5. Does PaddleOCR run on the OCI ARM64 server (the pre-GPU stopgap)?
6. Can Indic-Transcribe auto-detect the language on short clips, or must we always pass it?
