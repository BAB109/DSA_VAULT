import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { pool } from '../db/pool.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Import LeetCode problem set CSV into catalog_problems table.
 *
 * @param {string} csvFilePath - Path to the CSV file
 * @param {object} options - Execution options
 * @returns {Promise<{ rowsRead: number, insertedUpdated: number, skipped: number }>}
 */
export async function importCatalog(csvFilePath, options = { closePool: false }) {
  const resolvedPath = path.resolve(process.cwd(), csvFilePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`CSV file not found at path: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const rowsRead = records.length;
  let skipped = 0;
  const validRows = [];

  for (let idx = 0; idx < records.length; idx++) {
    const row = records[idx];
    const rawId = row.frontendQuestionId ? String(row.frontendQuestionId).trim() : '';
    const lcNumber = Number(rawId);

    // Validate that frontendQuestionId is a positive integer
    if (!rawId || !Number.isInteger(lcNumber) || lcNumber <= 0) {
      skipped++;
      console.warn(
        `[Row ${idx + 1}] Skipped: Invalid frontendQuestionId "${row.frontendQuestionId}". Expected a positive integer.`
      );
      continue;
    }

    const title = (row.title || '').trim();
    const slug = (row.titleSlug || '').trim();
    if (!title || !slug) {
      skipped++;
      console.warn(`[Row ${idx + 1}] Skipped: Missing title or titleSlug.`);
      continue;
    }

    const rawDiff = (row.difficulty || '').trim();
    const difficulty = ['Easy', 'Medium', 'Hard'].includes(rawDiff) ? rawDiff : null;
    const topicTags = row.topicTags ? String(row.topicTags).trim() : null;

    validRows.push({
      lc_number: lcNumber,
      title,
      slug,
      difficulty,
      topic_tags: topicTags,
    });
  }

  let client;
  let insertedUpdated = 0;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Batch upsert in chunks to optimize round-trips within the transaction
    const CHUNK_SIZE = 500;
    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);
      const valueClauses = [];
      const values = [];

      chunk.forEach((item, index) => {
        const offset = index * 5;
        valueClauses.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
        );
        values.push(item.lc_number, item.title, item.slug, item.difficulty, item.topic_tags);
      });

      const upsertSql = `
        INSERT INTO catalog_problems (lc_number, title, slug, difficulty, topic_tags)
        VALUES ${valueClauses.join(', ')}
        ON CONFLICT (lc_number) DO UPDATE SET
          title = EXCLUDED.title,
          slug = EXCLUDED.slug,
          difficulty = EXCLUDED.difficulty,
          topic_tags = EXCLUDED.topic_tags
      `;

      await client.query(upsertSql, values);
      insertedUpdated += chunk.length;
    }

    await client.query('COMMIT');
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error('Import transaction rolled back due to error:', err.message);
    throw err;
  } finally {
    if (client) {
      client.release();
    }
    if (options.closePool) {
      await pool.end().catch(() => {});
    }
  }

  console.log('\nCatalog Import Summary:');
  console.log(`- Rows read: ${rowsRead}`);
  console.log(`- Inserted/updated: ${insertedUpdated}`);
  console.log(`- Skipped: ${skipped}`);

  return { rowsRead, insertedUpdated, skipped };
}

// CLI execution handler
if (process.argv[1] === __filename) {
  const targetCsv = process.argv[2];
  if (!targetCsv) {
    console.error('Error: Missing CSV path argument.');
    console.error('Usage: node scripts/import-catalog.js <path-to-csv>');
    process.exit(1);
  }

  try {
    await importCatalog(targetCsv, { closePool: true });
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
}
