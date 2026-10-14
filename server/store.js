import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dataFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'db.json');

let queue = Promise.resolve();

function readDb() {
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

export function read() {
  return queue.then(() => readDb());
}

export function update(mutator) {
  const run = queue.then(() => {
    const db = readDb();
    const result = mutator(db);
    fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
