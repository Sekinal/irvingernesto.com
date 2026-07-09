---
title: 'Fast, Near-Lossless CPU OCR: Running PP-OCRv6 on OpenVINO'
description: 'How I made PP-OCRv6 text detection and recognition run 1.4 to 2.7x faster on a plain CPU with OpenVINO, why ONNX Runtime alone barely helps, the exact accuracy cost of the one speed trick that is not free, and the benchmark I built to prove all of it.'
pubDate: 2026-01-20
tags: ['OCR', 'OpenVINO', 'Performance', 'CPU', 'Open Source']
---

OCR is one of those workloads that quietly pushes you toward a GPU bill. You want to pull text out of receipts, forms, or scanned pages, you reach for a good model, and the fast path everyone shows you runs on a graphics card. But most people running OCR at volume are running it on servers that already have CPUs sitting mostly idle. The GPU is there to make the model fast, not because the task demands one. So I asked a narrower question: how fast can I make [PP-OCRv6](https://huggingface.co/PaddlePaddle), a genuinely strong open OCR model, on an ordinary CPU, without touching the weights and without lying about what it costs in accuracy?

The answer is [ppocrv6-fast-cpu](https://github.com/Sekinal/ppocrv6-fast-cpu): the unchanged PP-OCRv6 model, detection plus recognition, run through [OpenVINO](https://github.com/openvinotoolkit/openvino). On my CPU it comes out 1.4x faster than native PyTorch in `exact` mode and up to 2.7x in `fast` (bf16). The spine of this whole project is a pair of words that usually do not go together: fast AND honest about the tiny accuracy cost. Here is what that actually meant to build.

## OpenVINO is the win, not ONNX

The obvious first move for CPU inference is to export the model to ONNX and run ONNX Runtime. Everyone does this. So I did it, measured it, and it was almost worthless: plain ONNX Runtime on CPU came in at 1.04x on the small tier and 1.11x on the medium tier over PyTorch. That is a rounding error. If I had quoted "we exported to ONNX for CPU speed" as a result, I would have been quoting nothing.

The real speedup lives one layer down, in the kernels. OpenVINO ships oneDNN AVX-512 convolution kernels that are simply better at saturating a modern CPU than what PyTorch or the ONNX Runtime CPU provider reach for by default. Same model, same math, same inputs: swapping only the engine takes the medium tier from 7385 ms in PyTorch to 5126 ms in OpenVINO `exact`, a 1.44x win, and with bf16 down to 2779 ms, 2.66x. The pipeline itself is thin. Detection runs a DB (differentiable binarization) model, I crop the detected text lines, and recognition runs a CTC head over each crop. All the heavy convolution goes to OpenVINO; everything else is deliberately untouched.

That "deliberately untouched" part is the whole trick to staying accurate. I reuse the exact HuggingFace PP-OCRv6 image processors for pre and post processing, verbatim:

```python
def processor(model_id):
    if model_id not in _proc_cache:
        from transformers import AutoImageProcessor
        _proc_cache[model_id] = AutoImageProcessor.from_pretrained(model_id)
    return _proc_cache[model_id]
```

The only thing that changes versus native PP-OCRv6 is how the convolutions execute. Feed OpenVINO fp32 the identical input, and its output is bit-identical to PyTorch. I confirmed that on 34 of 34 documents. At the engine level, the speed is free.

## The one optimization that is not free, and I say so

If the engine is bit-identical, why do I call the whole thing near-lossless instead of lossless? Because of one pipeline decision, and it is the interesting one.

Recognition runs once per detected text line, and text crops vary wildly in width: a two-character label and a ninety-character sentence are the same model, different input shapes. The naive fix is to pad every crop in a batch to a common width. That is a trap: padding to a shared width corrupts the CTC decode, because the recognizer reads the padded region as content and the transcription drifts. So I process each crop at its natural width instead. Correct, but now OpenVINO sees a new input shape on nearly every crop and recompiles, which thrashes.

The compromise is width-bucketing. I round each crop's width up to the next multiple of 64, so OpenVINO only ever sees a handful of shapes and caches them:

```python
w = pv.shape[3]
wb = ((w + _REC_WMULT - 1) // _REC_WMULT) * _REC_WMULT
if wb > w:
    pv = np.pad(pv, ((0, 0), (0, 0), (0, 0), (0, wb - w)))
```

This is worth roughly a 1.4x on recognition and it fixes the shape thrash. But it is the one place the output can differ from native, because native runs every crop at its exact natural width and I run it at the bucketed width. That residual is small: `exact` mode is over 99.6% character-identical to native, 0.09% CER on the small tier and 0.36% on the medium tier. It is not zero. I could make it zero by disabling bucketing and eating the speed loss, and the code lets you do exactly that. But I refuse to call this bit-lossless when it is not, because the difference between "lossless" and "99.9% lossless with a named, understood cause" is the difference between marketing and engineering.

There are two other honest wins worth naming. The `fast` mode runs bf16, which roughly doubles throughput on AVX-512-BF16 CPUs; detection boxes stay identical because the DB post-process is robust to the rounding, and recognition takes about 0.5% CER, with the rare misses landing on the hardest glyphs like stylized fonts and some CJK punctuation. And on the medium detector I do a lossless structural reparameterization: RepLKFPN's IntraclassBlocks sum three parallel convolutions per group (a symmetric KxK plus a vertical and a horizontal strip), and because they share input and output shape they fuse exactly into one KxK conv by zero-padding the smaller kernels and summing weights. Nine convs per block become three, and the output is identical up to float accumulation order. That one is genuinely free.

## Why the benchmark is the actual product

Here is the part I care about most. Anyone can run a model twice and tweet a speedup. I did not want a number, I wanted a result I would trust if someone else published it, so the benchmark is built to survive scrutiny.

I measured 143 documents: 131 dense arXiv pages rendered at 150 DPI, deliberately text-heavy at 40 to 250 lines each, plus 12 scene and multilingual images to stress detection on non-document layouts. Every configuration, two tiers by two modes, ran against native PyTorch, plain ONNX Runtime, and off-the-shelf RapidOCR. Point estimates carry 95% confidence intervals: t-based for means, bootstrap with 5000 resamples for medians and CER, Clopper-Pearson exact intervals for the page-match proportion. Engine and mode contrasts are tested with paired Wilcoxon signed-rank tests, because latency is right-skewed and a non-parametric paired test is the honest choice. The figures are R and ggplot2.

That rigor is not decoration, it is what lets me make the honesty precise instead of hand-wavy. It is why I can tell you the sub-0.4% CER on `exact` comes from bucketing and not from OpenVINO, because the engine-only comparison shows bit-identical output while the full pipeline shows the residual. It is why I can say latency is driven by text density and not page count: the distribution is bimodal, sparse scene images sit near 50 to 450 ms while dense pages sit at 1 to 6 seconds, and the same medium `exact` config that takes 6 seconds on a 50-line arXiv page takes 457 ms median on the scene images. Plan capacity by characters per page, not pages per second. It is also why I can report where I lose: RapidOCR runs older PP-OCRv4 models, so that is a tool comparison and not a same-model engine swap, and I label it as such rather than pretending it is apples to apples.

The measurement rules are boring on purpose. Latency is the minimum of two timed runs per document, so the warm second run rejects shape-compilation spikes and scheduler noise. Accuracy is measured against each tier's own native PyTorch output computed with identical pre and post processing, a faithful-reproduction metric, not human ground truth, so the only variable is the inference path. Hardware is an AMD Ryzen 7 8845HS, Zen 4, 8 physical cores with AVX-512-BF16, running 8 threads, and I say that loudly because absolute latency is hardware-dependent even though the relative engine, mode, and tier results are stable.

## What this is, and what it is not

This wraps the public, Apache-2.0 PP-OCRv6 model unchanged. There is no custom-trained model here and no new weights. All the speed comes from the inference path: the right engine, a lossless reparameterization, bf16 where it is safe, and a width-bucketing knob whose exact cost I can quote to two decimal places. Self-hosting it wins on cost at volume, on privacy because no data leaves your network, and on running air-gapped, at the price of running it yourself.

I think the honesty is the feature. It is easy to ship "lossless CPU OCR, 2.7x faster." It is harder, and more useful, to ship "1.4 to 2.7x faster, over 99.6% character-identical, here is the one place it is not perfect and exactly why, and here are 143 documents with confidence intervals so you can check me." The second one is the one I would want to depend on.
