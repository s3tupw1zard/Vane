import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

const LEGACY_CHAT_COLUMNS = [
  'id',
  'title',
  'createdAt',
  'focusMode',
  'files',
] as const;
const CURRENT_CHAT_COLUMNS = [
  'id',
  'title',
  'createdAt',
  'sources',
  'files',
] as const;
const LEGACY_MESSAGE_COLUMNS = [
  'id',
  'content',
  'chatId',
  'messageId',
  'type',
  'metadata',
] as const;
const INTERMEDIATE_MESSAGE_COLUMNS = [
  'id',
  'type',
  'chatId',
  'createdAt',
  'messageId',
  'content',
  'sources',
] as const;
const CURRENT_MESSAGE_COLUMNS = [
  'id',
  'messageId',
  'chatId',
  'backendId',
  'query',
  'createdAt',
  'responseBlocks',
  'status',
] as const;
const USER_COLUMNS = [
  'id',
  'username',
  'password_hash',
  'role',
  'createdAt',
] as const;
const SESSION_COLUMNS = ['id', 'userId', 'expiresAt', 'createdAt'] as const;

type MainSchemaState = 'fresh' | 'legacy' | 'intermediate' | 'current';

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface LegacyMessageRow {
  id: number;
  type: string | null;
  metadata: unknown;
  content: string;
  chatId: string;
  messageId: string;
}

interface IntermediateMessageRow {
  id: number;
  messageId: string;
  chatId: string;
  type: string | null;
  content: string | null;
  createdAt: string;
  sources: unknown;
}

interface MigrationResult {
  backupPath: string | null;
  appliedMigrations: string[];
}

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table),
  );
}

function getColumns(db: Database.Database, table: string): ColumnInfo[] {
  if (!tableExists(db, table)) return [];
  return db.prepare(`PRAGMA table_info("${table}")`).all() as ColumnInfo[];
}

function hasExactColumns(
  db: Database.Database,
  table: string,
  expected: readonly string[],
): boolean {
  const actual = getColumns(db, table)
    .map((column) => column.name)
    .sort();
  return (
    actual.length === expected.length &&
    [...expected].sort().every((column, index) => column === actual[index])
  );
}

function describeTable(db: Database.Database, table: string): string {
  const columns = getColumns(db, table).map((column) => column.name);
  return tableExists(db, table)
    ? `${table}=[${columns.join(', ')}]`
    : `${table}=<missing>`;
}

function schemaError(db: Database.Database, message: string): Error {
  return new Error(
    `${message}. Detected columns: ${['chats', 'messages', 'users', 'sessions']
      .map((table) => describeTable(db, table))
      .join('; ')}`,
  );
}

function assertColumn(
  db: Database.Database,
  table: string,
  name: string,
  expected: Partial<Pick<ColumnInfo, 'type' | 'notnull' | 'dflt_value' | 'pk'>>,
): void {
  const column = getColumns(db, table).find((item) => item.name === name);
  if (!column)
    throw schemaError(db, `Table ${table} is missing column ${name}`);

  if (expected.type && column.type.toUpperCase() !== expected.type) {
    throw schemaError(
      db,
      `Column ${table}.${name} has type ${column.type}, expected ${expected.type}`,
    );
  }
  if (expected.notnull !== undefined && column.notnull !== expected.notnull) {
    throw schemaError(
      db,
      `Column ${table}.${name} has notnull=${column.notnull}, expected ${expected.notnull}`,
    );
  }
  if (expected.pk !== undefined && column.pk !== expected.pk) {
    throw schemaError(
      db,
      `Column ${table}.${name} has pk=${column.pk}, expected ${expected.pk}`,
    );
  }
  if (
    expected.dflt_value !== undefined &&
    column.dflt_value !== expected.dflt_value
  ) {
    throw schemaError(
      db,
      `Column ${table}.${name} has default ${column.dflt_value}, expected ${expected.dflt_value}`,
    );
  }
}

function hasUniqueColumn(
  db: Database.Database,
  table: string,
  column: string,
): boolean {
  const indexes = db.prepare(`PRAGMA index_list("${table}")`).all() as Array<{
    name: string;
    unique: number;
  }>;
  return indexes.some((index) => {
    if (index.unique !== 1) return false;
    const columns = db
      .prepare(`PRAGMA index_info("${index.name}")`)
      .all() as Array<{ name: string }>;
    return columns.length === 1 && columns[0].name === column;
  });
}

function validateLegacySchema(db: Database.Database): void {
  assertColumn(db, 'chats', 'id', { type: 'TEXT', pk: 1 });
  assertColumn(db, 'chats', 'title', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'chats', 'createdAt', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'chats', 'focusMode', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'chats', 'files', {
    type: 'TEXT',
    dflt_value: "'[]'",
  });
  assertColumn(db, 'messages', 'id', { type: 'INTEGER', pk: 1 });
  assertColumn(db, 'messages', 'content', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'messages', 'chatId', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'messages', 'messageId', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'messages', 'type', { type: 'TEXT' });
  assertColumn(db, 'messages', 'metadata', { type: 'TEXT' });
}

function validateIntermediateSchema(db: Database.Database): void {
  assertColumn(db, 'chats', 'id', { type: 'TEXT', pk: 1 });
  assertColumn(db, 'chats', 'title', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'chats', 'createdAt', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'chats', 'focusMode', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'chats', 'files', {
    type: 'TEXT',
    dflt_value: "'[]'",
  });
  assertColumn(db, 'messages', 'id', { type: 'INTEGER', pk: 1 });
  assertColumn(db, 'messages', 'type', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'messages', 'chatId', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'messages', 'createdAt', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'messages', 'messageId', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'messages', 'content', { type: 'TEXT' });
  assertColumn(db, 'messages', 'sources', {
    type: 'TEXT',
    dflt_value: "'[]'",
  });
}

function validateCurrentSchema(db: Database.Database): void {
  assertColumn(db, 'chats', 'id', { type: 'TEXT', pk: 1 });
  assertColumn(db, 'chats', 'title', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'chats', 'createdAt', { type: 'TEXT', notnull: 1 });
  assertColumn(db, 'chats', 'sources', {
    type: 'TEXT',
    dflt_value: "'[]'",
  });
  assertColumn(db, 'chats', 'files', {
    type: 'TEXT',
    dflt_value: "'[]'",
  });
  assertColumn(db, 'messages', 'id', { type: 'INTEGER', pk: 1 });
  for (const column of [
    'messageId',
    'chatId',
    'backendId',
    'query',
    'createdAt',
  ]) {
    assertColumn(db, 'messages', column, { type: 'TEXT', notnull: 1 });
  }
  assertColumn(db, 'messages', 'responseBlocks', {
    type: 'TEXT',
    dflt_value: "'[]'",
  });
  assertColumn(db, 'messages', 'status', {
    type: 'TEXT',
    dflt_value: "'answering'",
  });
  if (getColumns(db, 'chats').some((column) => column.name === 'userId')) {
    assertColumn(db, 'chats', 'userId', {
      type: 'TEXT',
      notnull: 1,
      dflt_value: "'anonymous'",
    });
  }
}

function validateAuthTables(db: Database.Database): void {
  if (tableExists(db, 'users')) {
    if (!hasExactColumns(db, 'users', USER_COLUMNS)) {
      throw schemaError(db, 'The users table has an unsupported schema');
    }
    assertColumn(db, 'users', 'id', { type: 'TEXT', pk: 1 });
    assertColumn(db, 'users', 'username', { type: 'TEXT', notnull: 1 });
    assertColumn(db, 'users', 'password_hash', { type: 'TEXT', notnull: 1 });
    assertColumn(db, 'users', 'role', {
      type: 'TEXT',
      notnull: 1,
      dflt_value: "'user'",
    });
    assertColumn(db, 'users', 'createdAt', { type: 'TEXT', notnull: 1 });
    if (!hasUniqueColumn(db, 'users', 'username')) {
      throw schemaError(
        db,
        'Column users.username is not uniquely constrained',
      );
    }
  }

  if (tableExists(db, 'sessions')) {
    if (!hasExactColumns(db, 'sessions', SESSION_COLUMNS)) {
      throw schemaError(db, 'The sessions table has an unsupported schema');
    }
    assertColumn(db, 'sessions', 'id', { type: 'TEXT', pk: 1 });
    assertColumn(db, 'sessions', 'userId', { type: 'TEXT', notnull: 1 });
    assertColumn(db, 'sessions', 'expiresAt', { type: 'TEXT', notnull: 1 });
    assertColumn(db, 'sessions', 'createdAt', { type: 'TEXT', notnull: 1 });
  }
}

function detectMainSchema(db: Database.Database): MainSchemaState {
  const hasChats = tableExists(db, 'chats');
  const hasMessages = tableExists(db, 'messages');

  if (!hasChats && !hasMessages) {
    if (tableExists(db, 'users') || tableExists(db, 'sessions')) {
      throw schemaError(db, 'Auth tables exist without application tables');
    }
    return 'fresh';
  }
  if (!hasChats || !hasMessages) {
    throw schemaError(
      db,
      'The database has only part of the application schema',
    );
  }

  const legacyChats = hasExactColumns(db, 'chats', LEGACY_CHAT_COLUMNS);
  const currentChats =
    hasExactColumns(db, 'chats', CURRENT_CHAT_COLUMNS) ||
    hasExactColumns(db, 'chats', [...CURRENT_CHAT_COLUMNS, 'userId']);

  if (legacyChats && hasExactColumns(db, 'messages', LEGACY_MESSAGE_COLUMNS)) {
    validateLegacySchema(db);
    validateAuthTables(db);
    return 'legacy';
  }
  if (
    legacyChats &&
    hasExactColumns(db, 'messages', INTERMEDIATE_MESSAGE_COLUMNS)
  ) {
    validateIntermediateSchema(db);
    validateAuthTables(db);
    return 'intermediate';
  }
  if (
    currentChats &&
    hasExactColumns(db, 'messages', CURRENT_MESSAGE_COLUMNS)
  ) {
    validateCurrentSchema(db);
    validateAuthTables(db);
    return 'current';
  }

  throw schemaError(db, 'The database schema is unknown or inconsistent');
}

function sanitizeSql(content: string): string[] {
  return content
    .split(/--> statement-breakpoint/g)
    .map((statement) =>
      statement
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('-->'))
        .join('\n')
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

function parseNestedJson(
  value: unknown,
  fallback: unknown,
  context: string,
): unknown {
  let parsed = value ?? fallback;

  for (let depth = 0; typeof parsed === 'string'; depth += 1) {
    if (depth === 5) {
      throw new Error(`${context} exceeds the maximum JSON nesting depth`);
    }

    const source = parsed.trim() || JSON.stringify(fallback);
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      throw new Error(`${context} contains invalid JSON`, { cause: error });
    }
  }

  return parsed;
}

function assertTemporaryTable(
  db: Database.Database,
  table: string,
  expectedColumns: readonly string[],
): void {
  if (tableExists(db, table) && !hasExactColumns(db, table, expectedColumns)) {
    throw schemaError(db, `Temporary table ${table} has an unknown schema`);
  }
}

function migrateLegacyMessages(db: Database.Database): void {
  assertTemporaryTable(
    db,
    'messages_with_sources',
    INTERMEDIATE_MESSAGE_COLUMNS,
  );

  const sourceRows = db
    .prepare(
      'SELECT id, type, metadata, content, chatId, messageId FROM messages ORDER BY id ASC',
    )
    .all() as LegacyMessageRow[];
  const transformed: Array<{
    type: 'user' | 'assistant' | 'source';
    chatId: string;
    createdAt: string;
    messageId: string;
    content: string;
    sources: string;
  }> = [];

  for (const row of sourceRows) {
    if (row.type !== 'user' && row.type !== 'assistant') {
      throw new Error(
        `Legacy message row ${row.id} has unknown role ${row.type}`,
      );
    }

    const metadata = parseNestedJson(
      row.metadata,
      {},
      `Legacy message row ${row.id} metadata`,
    );
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new Error(`Legacy message row ${row.id} metadata is not an object`);
    }

    const createdAt = (metadata as Record<string, unknown>).createdAt;
    if (typeof createdAt !== 'string' || createdAt.length === 0) {
      throw new Error(
        `Legacy message row ${row.id} has no valid createdAt value`,
      );
    }

    if (row.type === 'assistant') {
      const sources = parseNestedJson(
        (metadata as Record<string, unknown>).sources,
        [],
        `Legacy message row ${row.id} sources`,
      );
      if (!Array.isArray(sources)) {
        throw new Error(`Legacy message row ${row.id} sources is not an array`);
      }
      if (sources.length > 0) {
        transformed.push({
          type: 'source',
          chatId: row.chatId,
          createdAt,
          messageId: `${row.messageId}-source`,
          content: '',
          sources: JSON.stringify(sources),
        });
      }
    }

    transformed.push({
      type: row.type,
      chatId: row.chatId,
      createdAt,
      messageId: row.messageId,
      content: row.content,
      sources: '[]',
    });
  }

  db.exec('DROP TABLE IF EXISTS messages_with_sources');
  db.exec(`
    CREATE TABLE messages_with_sources (
      id INTEGER PRIMARY KEY,
      type TEXT NOT NULL,
      chatId TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      messageId TEXT NOT NULL,
      content TEXT,
      sources TEXT DEFAULT '[]'
    )
  `);
  const insert = db.prepare(`
    INSERT INTO messages_with_sources
      (type, chatId, createdAt, messageId, content, sources)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const row of transformed) {
    insert.run(
      row.type,
      row.chatId,
      row.createdAt,
      row.messageId,
      row.content,
      row.sources,
    );
  }

  const persisted = db
    .prepare(
      `
      SELECT type, chatId, createdAt, messageId, content, sources
      FROM messages_with_sources
      ORDER BY id
    `,
    )
    .all();
  if (JSON.stringify(persisted) !== JSON.stringify(transformed)) {
    throw new Error('Legacy message transformation did not preserve every row');
  }

  db.exec('DROP TABLE messages');
  db.exec('ALTER TABLE messages_with_sources RENAME TO messages');
}

function migrateIntermediateSchema(db: Database.Database): void {
  assertTemporaryTable(db, 'chats_new', CURRENT_CHAT_COLUMNS);
  assertTemporaryTable(db, 'messages_new', CURRENT_MESSAGE_COLUMNS);

  const chatRows = db
    .prepare('SELECT id, title, createdAt, files FROM chats ORDER BY id ASC')
    .all() as Array<{
    id: string;
    title: string;
    createdAt: string;
    files: unknown;
  }>;
  const transformedChats = chatRows.map((chat) => {
    const files = parseNestedJson(chat.files, [], `Chat ${chat.id} files`);
    if (!Array.isArray(files)) {
      throw new Error(`Chat ${chat.id} files is not an array`);
    }
    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      sources: '["web"]',
      files: JSON.stringify(files),
    };
  });

  const sourceRows = db
    .prepare(
      'SELECT id, messageId, chatId, type, content, createdAt, sources FROM messages ORDER BY id ASC',
    )
    .all() as IntermediateMessageRow[];
  const transformedMessages: Array<{
    messageId: string;
    chatId: string;
    backendId: string;
    query: string;
    createdAt: string;
    responseBlocks: string;
    status: 'answering' | 'completed';
  }> = [];
  let pending: {
    messageId: string;
    chatId: string;
    query: string;
    createdAt: string;
    response?: string;
    sources: unknown[];
  } | null = null;

  const flushPending = () => {
    if (!pending) return;
    const blocks: Array<{ id: string; type: string; data: unknown }> = [
      {
        id: randomUUID(),
        type: 'text',
        data: pending.response ?? '',
      },
    ];
    if (pending.sources.length > 0) {
      blocks.push({ id: randomUUID(), type: 'source', data: pending.sources });
    }
    transformedMessages.push({
      messageId: pending.messageId,
      chatId: pending.chatId,
      backendId: `${pending.messageId}-backend`,
      query: pending.query,
      createdAt: pending.createdAt,
      responseBlocks: JSON.stringify(blocks),
      status: pending.response === undefined ? 'answering' : 'completed',
    });
    pending = null;
  };

  for (const row of sourceRows) {
    if (!['user', 'assistant', 'source'].includes(row.type ?? '')) {
      throw new Error(
        `Intermediate message row ${row.id} has unknown role ${row.type}`,
      );
    }

    if (row.type === 'user') {
      flushPending();
      if (typeof row.content !== 'string') {
        throw new Error(
          `Intermediate user message row ${row.id} has no content`,
        );
      }
      pending = {
        messageId: row.messageId,
        chatId: row.chatId,
        query: row.content,
        createdAt: row.createdAt,
        sources: [],
      };
      continue;
    }

    if (!pending || pending.chatId !== row.chatId) {
      throw new Error(
        `Intermediate message row ${row.id} has no matching user request`,
      );
    }
    if (row.type === 'assistant') {
      if (pending.response !== undefined || typeof row.content !== 'string') {
        throw new Error(
          `Intermediate assistant message row ${row.id} is ambiguous`,
        );
      }
      pending.response = row.content;
    } else {
      const sources = parseNestedJson(
        row.sources,
        [],
        `Intermediate source row ${row.id} sources`,
      );
      if (!Array.isArray(sources)) {
        throw new Error(
          `Intermediate source row ${row.id} sources is not an array`,
        );
      }
      pending.sources.push(...sources);
    }
  }
  flushPending();

  db.exec('DROP TABLE IF EXISTS chats_new');
  db.exec(`
    CREATE TABLE chats_new (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      sources TEXT DEFAULT '[]',
      files TEXT DEFAULT '[]'
    )
  `);
  const insertChat = db.prepare(`
    INSERT INTO chats_new (id, title, createdAt, sources, files)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const chat of transformedChats) {
    insertChat.run(
      chat.id,
      chat.title,
      chat.createdAt,
      chat.sources,
      chat.files,
    );
  }

  db.exec('DROP TABLE IF EXISTS messages_new');
  db.exec(`
    CREATE TABLE messages_new (
      id INTEGER PRIMARY KEY,
      messageId TEXT NOT NULL,
      chatId TEXT NOT NULL,
      backendId TEXT NOT NULL,
      query TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      responseBlocks TEXT DEFAULT '[]',
      status TEXT DEFAULT 'answering'
    )
  `);
  const insertMessage = db.prepare(`
    INSERT INTO messages_new
      (messageId, chatId, backendId, query, createdAt, responseBlocks, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const message of transformedMessages) {
    insertMessage.run(
      message.messageId,
      message.chatId,
      message.backendId,
      message.query,
      message.createdAt,
      message.responseBlocks,
      message.status,
    );
  }

  const persistedChats = db
    .prepare(
      'SELECT id, title, createdAt, sources, files FROM chats_new ORDER BY id',
    )
    .all();
  const persistedMessages = db
    .prepare(
      `
      SELECT messageId, chatId, backendId, query, createdAt, responseBlocks, status
      FROM messages_new
      ORDER BY id
    `,
    )
    .all();
  if (
    JSON.stringify(persistedChats) !== JSON.stringify(transformedChats) ||
    JSON.stringify(persistedMessages) !== JSON.stringify(transformedMessages)
  ) {
    throw new Error(
      'Intermediate schema transformation did not preserve every record',
    );
  }

  db.exec('DROP TABLE chats');
  db.exec('ALTER TABLE chats_new RENAME TO chats');
  db.exec('DROP TABLE messages');
  db.exec('ALTER TABLE messages_new RENAME TO messages');
}

function migrationIsSatisfied(
  db: Database.Database,
  migrationName: string,
): boolean {
  const state = detectMainSchema(db);
  if (migrationName === '0000') return state !== 'fresh';
  if (migrationName === '0001') {
    return state === 'intermediate' || state === 'current';
  }
  if (migrationName === '0002') return state === 'current';
  if (migrationName === '0003') {
    return tableExists(db, 'users') && tableExists(db, 'sessions');
  }
  if (migrationName === '0004') {
    return (
      state === 'current' &&
      getColumns(db, 'chats').some((c) => c.name === 'userId')
    );
  }
  return true;
}

function nextBackupPath(databasePath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `${databasePath}.backup-${timestamp}`;
  let candidate = base;
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function runMigrations(
  db: Database.Database,
  migrationsFolder: string,
): Promise<MigrationResult> {
  const initialState = detectMainSchema(db);
  const hadApplicationTables = initialState !== 'fresh';
  let backupPath: string | null = null;

  const migrationFiles = fs
    .readdirSync(migrationsFolder)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const migrationNames = migrationFiles.map(
    (file) => file.split('_')[0] || file,
  );
  const requiredMigrations = ['0000', '0001', '0002', '0003', '0004'];
  if (
    new Set(migrationNames).size !== migrationNames.length ||
    requiredMigrations.some((migration) => !migrationNames.includes(migration))
  ) {
    throw new Error(
      `Migration directory is incomplete or ambiguous: [${migrationFiles.join(', ')}]`,
    );
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS ran_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      run_on DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const recorded = new Set(
    (
      db.prepare('SELECT name FROM ran_migrations').all() as Array<{
        name: string;
      }>
    ).map((row) => row.name),
  );
  const appliedMigrations: string[] = [];

  for (const file of migrationFiles) {
    const migrationName = file.split('_')[0] || file;
    if (
      recorded.has(migrationName) &&
      migrationIsSatisfied(db, migrationName)
    ) {
      console.log(`Skipping verified migration: ${file}`);
      continue;
    }

    const state = detectMainSchema(db);
    const destructive =
      (migrationName === '0001' && state === 'legacy') ||
      (migrationName === '0002' && state === 'intermediate');
    if (destructive && hadApplicationTables && !backupPath) {
      if (!db.name || db.name === ':memory:') {
        throw new Error(
          'Cannot back up an in-memory database before migration',
        );
      }
      backupPath = nextBackupPath(path.resolve(db.name));
      await db.backup(backupPath);
      console.log(`Created pre-migration backup: ${backupPath}`);
    }

    const statements = sanitizeSql(
      fs.readFileSync(path.join(migrationsFolder, file), 'utf8'),
    );
    const applyMigration = db.transaction(() => {
      if (migrationName === '0000') {
        if (detectMainSchema(db) === 'fresh') {
          for (const statement of statements) db.exec(statement);
        }
      } else if (migrationName === '0001') {
        const currentState = detectMainSchema(db);
        if (currentState === 'legacy') migrateLegacyMessages(db);
      } else if (migrationName === '0002') {
        const currentState = detectMainSchema(db);
        if (currentState === 'intermediate') migrateIntermediateSchema(db);
      } else if (migrationName === '0003') {
        validateAuthTables(db);
        for (const statement of statements) db.exec(statement);
      } else if (migrationName === '0004') {
        if (
          !getColumns(db, 'chats').some((column) => column.name === 'userId')
        ) {
          for (const statement of statements) db.exec(statement);
        }
      } else {
        for (const statement of statements) db.exec(statement);
      }

      if (!migrationIsSatisfied(db, migrationName)) {
        throw schemaError(
          db,
          `Migration ${migrationName} did not satisfy its postconditions`,
        );
      }
      db.prepare('INSERT OR IGNORE INTO ran_migrations (name) VALUES (?)').run(
        migrationName,
      );
    });

    try {
      applyMigration.immediate();
      appliedMigrations.push(migrationName);
      recorded.add(migrationName);
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      console.error(`Failed to apply migration ${file}:`, error);
      throw error;
    }
  }

  if (!requiredMigrations.every((name) => migrationIsSatisfied(db, name))) {
    throw schemaError(db, 'Migration run did not reach the current schema');
  }

  return { backupPath, appliedMigrations };
}

export async function migrateDatabase(): Promise<MigrationResult> {
  const dataRoot = process.env.DATA_DIR || process.cwd();
  const databasePath = path.join(dataRoot, 'data', 'db.sqlite');
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const db = new Database(databasePath);
  try {
    return await runMigrations(db, path.join(process.cwd(), 'drizzle'));
  } finally {
    db.close();
  }
}
