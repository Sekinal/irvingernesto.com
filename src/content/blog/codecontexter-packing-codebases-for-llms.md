---
title: 'CodeContexter: Packing a Whole Codebase Into One LLM-Ready File'
description: 'How I built a fast, safety-first Rust CLI that walks an entire repository, respects .gitignore, redacts secrets before they leave your machine, and estimates the token budget, all in a single streamed pass.'
pubDate: 2026-03-08
tags: ['Rust', 'Developer Tools', 'LLM', 'CLI', 'Open Source']
---

Every time I wanted an LLM to reason about a whole project, I hit the same wall. The model needs context, but a project is not one file. It is hundreds of files scattered across folders, plus lock files, build artifacts, and a `.env` I would very much like to never paste into a chat window. Copying files by hand is slow, lossy, and dangerous. So I wrote [CodeContexter](https://github.com/yourusername/codecontexter): a Rust CLI that walks a repository and packs it into a single structured file that a model can actually read.

The whole thing is one binary and one job: take a directory, produce a clean, deduplicated, secret-free document with a file tree and every file's contents. Here is what turned out to be interesting under the hood.

## The walk has to be ignore-aware, not just fast

The naive version of this tool recursively reads every file. That version is useless, because it will happily dump `node_modules`, `target`, and a 40MB lock file into your context and blow the budget on noise.

So the walk is built on the `ignore` crate, the same directory traversal library that powers ripgrep. It gives me `.gitignore` semantics for free:

```rust
let walker = WalkBuilder::new(&root_path)
    .hidden(false)
    .git_ignore(true)
    .follow_links(false) // prevent symlink loops and duplication
    .overrides(overrides)
    .build();
```

Two of those flags are deliberate. `hidden(false)` means I do *not* skip dotfiles, because config like `.eslintrc` or `.github/workflows` is often exactly the context you want. And `follow_links(false)` closes a nasty failure mode: a symlink that points back up the tree can send a recursive walker into an infinite loop or silently duplicate half the repo. Turning link-following off makes the walk finite and honest.

The one thing `.gitignore` gets wrong for this use case is secrets. Plenty of repos commit or fail to ignore a stray `.pem` or `id_rsa`, and I do not want the walk to depend on the user having a perfect ignore file. So before the walk starts, I layer in hard-coded overrides that force-exclude the dangerous stuff regardless of what `.gitignore` says:

```rust
let hard_coded_excludes = vec![
    "!*.env", "!*.env.*", "!*.pem", "!*.key",
    "!id_rsa", "!id_ed25519", "!*.p12", "!*.pfx",
];
```

The `!` prefix in an override inverts it to an exclude, so these patterns are the tool's own opinion about what should never be aggregated, applied on top of the user's `.gitignore` and any `--exclude` globs they pass. Belt and suspenders. The file-level redaction below is the belt.

## Redaction is defense in depth, not the only defense

Excluding secret *files* handles the obvious case. It does not handle the API key someone hardcoded in the middle of a Python module. For that, every file's contents pass through a sanitizer before they are written out.

The sanitizer is a small set of compiled regexes, initialized once and reused across every file via a `OnceLock` so I am not recompiling patterns in a hot loop:

```rust
static SECRET_PATTERNS: OnceLock<Vec<Regex>> = OnceLock::new();
let patterns = SECRET_PATTERNS.get_or_init(|| vec![
    Regex::new(r"-----BEGIN [A-Z ]+ PRIVATE KEY-----").unwrap(),
    Regex::new(r"AKIA[0-9A-Z]{16}").unwrap(),
    Regex::new(r"(?i)sk-[a-zA-Z0-9]{20,}").unwrap(),
    Regex::new(r"gh[pousr]-[a-zA-Z0-9]{36}").unwrap(),
    Regex::new(r#"(?i)(api_key|secret|token|password)\s*[:=]\s*["'][a-zA-Z0-9]{32,}["']"#).unwrap(),
]);
```

These target the shapes that leak most: RSA and other PEM private key headers, AWS access keys (the `AKIA` prefix), OpenAI and Stripe style `sk-` keys, GitHub tokens across their prefix family (`ghp`, `gho`, `ghu`, `ghs`, `ghr`), and the generic `api_key = "..."` assignment pattern. Anything matching gets replaced with `[REDACTED SECRET]`. This is pattern matching, not proof, so the tool tells you to review output before sharing it. But it means the common ways a key escapes are covered by default, without the user thinking about it.

## Deciding what is even worth including

Before a file's bytes matter, the tool has to decide whether the file belongs at all. A few cheap filters do most of the work.

Empty files are dropped on a metadata check before any read. Binary files are caught by sampling: I read the file, look at up to the first 8192 bytes, and if any of them is a null byte, I treat it as binary and skip it.

```rust
fn is_binary(content: &[u8]) -> bool {
    let len = std::cmp::min(content.len(), 8192);
    content[..len].contains(&0)
}
```

That heuristic is crude and it is exactly right for this job. Real source code effectively never contains a null byte in its first 8KB, and images, compiled objects, and archives almost always do. Whitespace-only files are dropped after read, since a file that trims to nothing adds zero signal and non-zero tokens.

Large files get a different treatment. Anything over 1MB would dominate the budget, so instead of including or dropping it wholesale, the tool keeps the first 50 and last 50 lines and drops the middle with a marker noting how many lines were omitted. You usually want the imports and the shape of a big generated file, not its ten thousand middle lines.

## Token accounting so you know before you paste

Every artifact carries a token estimate, and the tool sums them into the header. The estimate is deliberately simple: characters divided by four.

```rust
const CHARS_PER_TOKEN: usize = 4;
let token_estimate = content_str.len() / CHARS_PER_TOKEN;
```

This is not a real tokenizer, and it does not try to be. Pulling in a model-specific BPE tokenizer would add a heavy dependency, tie the output to one model's vocabulary, and slow the whole thing down for a number that is a budgeting hint, not a billing figure. The four-characters-per-token approximation is close enough to tell you at a glance whether the output fits in a context window, which is the only decision the number needs to support.

## Parallelism, and streaming instead of buffering

File discovery is sequential because the directory walk is inherently ordered, but reading and processing every file is embarrassingly parallel. That phase runs across all cores with rayon: `collected_paths.par_iter()` fans the per-file work out, and a progress bar increments as each file lands. On a large repo this is where the wall-clock time is won.

Output is streamed, not assembled in memory. Rather than building one giant string and writing it at the end, the tool writes each artifact directly through a `BufWriter` as it goes. That keeps memory flat even on huge repositories, since the peak footprint is the artifacts themselves plus a small buffer, not a second full copy of the concatenated output.

## The output format is tuned for how models read code

The default output is Markdown, with JSON and XML available. Markdown is the default for a reason: it is what these models were trained on the most, and fenced code blocks with a language hint (```rust, ```python) are the strongest signal you can give a model about where one file ends and the next begins.

The document leads with a header line that states the file count and total token estimate, then a `text` fenced project tree so the model sees the structure before the contents, then each file as its own section with a metadata line (language, line count, token estimate, and a truncation flag when relevant) above its fenced body. JSON and XML exist for programmatic consumers, and the XML path carefully escapes `&`, `<`, `>`, quotes, and apostrophes so file contents cannot break the document.

## Why Rust was the right call

This tool touches the filesystem hard, needs to be safe by default, and wants to fan work across cores. Rust gives me all three without compromise: the `ignore` crate for correct traversal, rayon for parallelism that is a one-line change, and a compiler that will not let me leak a buffer or race a shared regex table. The result starts instantly, holds flat memory on repos of any size, and finishes fast enough that the token count is printed before you have finished reading the command you typed.

It is MIT licensed and it is the open-source project I reach for most, because the alternative is pasting files into a chat one at a time and hoping I did not include the wrong one.
