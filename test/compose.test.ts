// Pure-math checks for the compositing layout. Run: npx tsx test/compose.test.ts
import { bestGrid, rowSizes } from "../src/lib/compose";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) fails++;
  console.log(`${ok ? "✓" : "✗"} ${name}  got=${g} want=${w}`);
}

// Wide background (16:9 ≈ 1.78) with 8 items -> should prefer more columns than rows.
const g8wide = bestGrid(8, 1.78);
eq("8 items @1.78 -> 4x2", g8wide, { cols: 4, rows: 2 });

// Square-ish background with 9 items.
eq("9 items @1.0 -> 3x3", bestGrid(9, 1.0), { cols: 3, rows: 3 });

// Tall background -> more rows.
const tall = bestGrid(6, 0.5);
eq("6 items @0.5 -> 2x3", tall, { cols: 2, rows: 3 });

// Row distribution: remainder lands in earlier rows.
eq("rowSizes(8,2)", rowSizes(8, 2), [4, 4]);
eq("rowSizes(7,2)", rowSizes(7, 2), [4, 3]);
eq("rowSizes(8,3)", rowSizes(8, 3), [3, 3, 2]);
eq("rowSizes(1,1)", rowSizes(1, 1), [1]);

// Every row layout must sum back to n.
for (const [n, r] of [[8, 2], [13, 4], [20, 5], [7, 3]] as const) {
  const sum = rowSizes(n, r).reduce((a, b) => a + b, 0);
  eq(`sum rowSizes(${n},${r})==${n}`, sum, n);
}

console.log(fails === 0 ? "\n全部通过 ✅" : `\n${fails} 项失败 ❌`);
if (fails) process.exit(1);
