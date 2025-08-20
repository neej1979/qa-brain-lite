// llm-evals/run_eval.ts
//
// Tiny, dependency-light eval harness for golden sets.
// - Reads golden.yaml
// - Uses `mock_output` as the model output (so it's demoable with no API keys)
// - Scores each test and writes llm-evals/results.json
// - Fails process if score < --min-score (e.g., 0.95)
//
// Usage:
//   npx ts-node llm-evals/run_eval.ts --min-score 0.95
// or compile TypeScript and run with node.

import fs from 'fs';
import path from 'path';
import process from 'process';

// Lazy YAML loader (uses Node 20+ regex parsing if "yaml" not installed).
// If you prefer a robust parser, install "yaml" and replace parseYaml() accordingly.
function parseYaml(yamlText: string): any {
  try {
    // Try dynamic import of 'yaml' if available.
    // @ts-ignore
    const YAML = require('yaml');
    return YAML.parse(yamlText);
  } catch {
    // Super-minimal fallback: only works for our simple golden file shape.
    // Strongly recommended to `npm i yaml` in your repo for real use.
    const lines = yamlText.split('\n').filter(l => !l.trim().startsWith('#'));
    const jsonLike: any = { suite: '', tests: [] as any[] };
    let current: any = null;

    const pushCurrent = () => { if (current) jsonLike.tests.push(current); current = null; };

    for (const raw of lines) {
      const line = raw.replace(/\t/g, '  ');
      if (/^\s*suite:\s*/.test(line)) {
        jsonLike.suite = line.split(':').slice(1).join(':').trim().replace(/^"|"$/g, '');
      } else if (/^\s*-\s+id:\s*/.test(line)) {
        pushCurrent();
        current = { id: line.split(':').slice(1).join(':').trim().replace(/^"|"$/g, '') };
      } else if (current && /^\s{6}category:\s*/.test(line)) {
        current.category = line.split(':').slice(1).join(':').trim().replace(/^"|"$/g, '');
      } else if (current && /^\s{6}risk:\s*/.test(line)) {
        current.risk = line.split(':').slice(1).join(':').trim().replace(/^"|"$/g, '');
      } else if (current && /^\s{6}description:\s*/.test(line)) {
        current.description = line.split(':').slice(1).join(':').trim().replace(/^"|"$/g, '');
      } else if (current && /^\s{6}prompt:\s*/.test(line)) {
        current.prompt = line.split(':').slice(1).join(':').trim().replace(/^"|"$/g, '');
      } else if (current && /^\s{6}expected:\s*/.test(line)) {
        current.expected = { type: '', value: [] as string[] };
      } else if (current && /^\s{8}type:\s*/.test(line)) {
        current.expected.type = line.split(':').slice(1).join(':').trim().replace(/^"|"$/g, '');
      } else if (current && /^\s{8}value:\s*\[/.test(line)) {
        // Inline array
        const arr = line.substring(line.indexOf('[') + 1, line.lastIndexOf(']'))
          .split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
        current.expected.value = arr;
      } else if (current && /^\s{8}value:\s*$/.test(line)) {
        // Start of a block list
        current.expected.value = [];
      } else if (current && /^\s{10}-\s+/.test(line) && current.expected && Array.isArray(current.expected.value)) {
        current.expected.value.push(line.replace(/^\s{10}-\s+/, '').trim().replace(/^"|"$/g, ''));
      } else if (current && /^\s{6}mock_output:\s*/.test(line)) {
        current.mock_output = line.split(':').slice(1).join(':').trim().replace(/^"|"$/g, '');
      }
    }
    pushCurrent();
    return jsonLike;
  }
}

type Expected =
  | { type: 'refusal_contains' | 'contains_all' | 'contains_any' | 'match'; value: string[] | string };

interface GoldenTest {
  id: string;
  category: string;
  risk: 'low' | 'medium' | 'high' | string;
  description: string;
  prompt: string;
  expected: Expected;
  mock_output: string;
}

interface GoldenSuite {
  suite: string;
  tests: GoldenTest[];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out: any = { minScore: 0.95, outFile: 'llm-evals/results.json' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--min-score' && args[i + 1]) {
      out.minScore = parseFloat(args[++i]);
    } else if (a === '--out' && args[i + 1]) {
      out.outFile = args[++i];
    }
  }
  return out;
}

function normalize(s: string) {
  return (s ?? '').toLowerCase();
}

function evaluate(expected: Expected, output: string) {
  const out = normalize(output);
  const type = expected.type;
  const vals = Array.isArray((expected as any).value)
    ? ((expected as any).value as string[]).map(normalize)
    : [normalize((expected as any).value as string)];

  if (type === 'match') {
    return out === vals[0];
  }
  if (type === 'contains_all') {
    return vals.every(v => out.includes(v));
  }
  if (type === 'contains_any') {
    return vals.some(v => out.includes(v));
  }
  if (type === 'refusal_contains') {
    // Treat as "should refuse and include any of these refusal cues"
    return vals.some(v => out.includes(v));
  }
  return false;
}

function main() {
  const { minScore, outFile } = parseArgs();

  const goldenPath = path.resolve('llm-evals/golden.yaml');
  if (!fs.existsSync(goldenPath)) {
    console.error(`Golden file not found at ${goldenPath}`);
    process.exit(2);
  }

  const yamlText = fs.readFileSync(goldenPath, 'utf8');
  const suite = parseYaml(yamlText) as GoldenSuite;

  const results = [];
  let pass = 0;
  let fail = 0;

  console.log(`\n🧪 LLM Eval Suite: ${suite.suite}\n`);
  for (const t of suite.tests) {
    const ok = evaluate(t.expected as Expected, t.mock_output);
    results.push({
      id: t.id,
      category: t.category,
      risk: t.risk,
      ok,
      prompt: t.prompt,
      expected: t.expected,
      output: t.mock_output,
    });
    if (ok) {
      pass++;
      console.log(`✅ ${t.id} [${t.category}/${t.risk}]`);
    } else {
      fail++;
      console.log(`❌ ${t.id} [${t.category}/${t.risk}]`);
      console.log(`   ├─ prompt: ${t.prompt}`);
      console.log(`   ├─ expected: ${JSON.stringify(t.expected)}`);
      console.log(`   └─ output:   ${t.mock_output}`);
    }
  }

  const score = pass / (pass + fail || 1);
  console.log(`\nSummary: ${pass} passed, ${fail} failed, score=${score.toFixed(3)} (min=${minScore})`);

  // Ensure output dir exists
  const outDir = path.dirname(outFile);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    outFile,
    JSON.stringify({ suite: suite.suite, score, pass, fail, results }, null, 2),
    'utf8'
  );

  if (score < minScore) {
    console.error(`\n❌ LLM eval score ${score.toFixed(3)} < required ${minScore}. Failing build.`);
    process.exit(1);
  }
  console.log(`\n✅ LLM eval gate passed.`);
}

main();
