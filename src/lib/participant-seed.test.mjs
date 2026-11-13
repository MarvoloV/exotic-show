import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = () => readFileSync(new URL("../../supabase/seeds/participants-batch.sql", import.meta.url), "utf8");
const names = ["MARIA GRACIA CORDOVA", "JESSICA JAULES", "LUIS MIGUEL AGURTO", "RENZO ZERGA", "MICHEL ACOSTA", "JOSE ANTONIO GUZMAN", "SANDRO ANGULO CCAHUANA", "DIEGO TORRES", "JENNY CANCHARI", "DAYANNA MEJIA", "SUSAN GALINDO", "PEDRO CASTRO", "KATHERINE NUÑEZ", "YERALDIN PEREZ", "VIKTORYIA PIATLISKAYA", "PEDRO REGIFO", "EUSKADY AYO", "VANESSA LEON VELARDE", "IRENE CRITOBAL", "MARÍA A. VILLANUEVA", "TRACY BLANCO", "MARIELA SALGADO", "MARICIELO INFANTE", "PATRICIA ANTO", "JOEL HINOJOSA", "ARLEEN GRATEROL"];

test("batch payload matches every requested code, name and payment", () => {
  const rows = [...sql().matchAll(/\('EX(\d{3})', '([^']+)', (\d+)\)/g)].map((m) => [Number(m[1]), m[2], Number(m[3])]);
  assert.deepEqual(rows, names.map((name, i) => [i + 1, name, [9, 10, 11, 19, 22].includes(i + 1) ? 70 : 80]));
  assert.equal(rows.length, 26);
  assert.equal(rows.filter((r) => r[2] === 80).length, 21);
  assert.equal(rows.filter((r) => r[2] === 70).length, 5);
  assert.equal(rows.reduce((sum, r) => sum + r[2], 0), 2030);
});

test("SQL declares atomic collision, default and guarded transactional sequence policy", () => {
  const s = sql();
  for (const pattern of [/^begin;/im, /commit;\s*$/i, /set local lock_timeout\s*=\s*'5s'/i, /set local statement_timeout\s*=\s*'30s'/i, /lock table public\.participants in share row exclusive mode/i, /on commit drop/i, /count\(\*\)\s*<>\s*26/i, /sum\(paid_amount\)\s*<>\s*2030/i, /join pg_temp\.participant_batch/i, /raise exception '.*collision/i, /seqincrement\s*<>\s*1/i, /seqcache\s*<>\s*1/i, /seqcycle/i, /alter sequence public\.participant_code_seq increment by 1/i, /last_value, is_called/i, /seqmax/i, /restart with/i, /insert into public\.participants\s*\(code, full_name, paid_amount\)/i, /'\/asistencia\/'\s*\|\|\s*p\.token\s+as attendance_path/i, /order by p\.code/i]) assert.match(s, pattern);
  assert.ok(s.search(/join pg_temp\.participant_batch/i) < s.search(/alter sequence public\.participant_code_seq increment/i));
  assert.doesNotMatch(s, /\b(setval|on conflict|truncate|delete from|disable row level security)\b/i);
  assert.doesNotMatch(s, /'[a-f0-9]{64}'/i);
});
