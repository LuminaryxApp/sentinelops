use rusqlite::{Connection, params, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};

/// Memory type classification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MemoryType {
    Auto,
    User,
    Conversation,
}

impl MemoryType {
    pub fn as_str(&self) -> &'static str {
        match self {
            MemoryType::Auto => "auto",
            MemoryType::User => "user",
            MemoryType::Conversation => "conversation",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "auto" => MemoryType::Auto,
            "user" => MemoryType::User,
            "conversation" => MemoryType::Conversation,
            _ => MemoryType::User,
        }
    }
}

/// A memory entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Memory {
    pub id: String,
    pub workspace_id: String,
    pub content: String,
    pub summary: Option<String>,
    #[serde(rename = "type")]
    pub memory_type: MemoryType,
    pub source_conversation_id: Option<String>,
    pub source_message_ids: Option<Vec<String>>,
    pub embedding_model: Option<String>,
    pub tags: Option<Vec<String>>,
    pub importance: i32,
    pub access_count: i32,
    pub last_accessed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub expires_at: Option<String>,
    pub is_pinned: bool,
    pub metadata: Option<serde_json::Value>,
}

/// Memory with similarity score for search results
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryWithScore {
    pub memory: Memory,
    pub score: f64,
    pub match_type: String,
}

/// Memory settings for a workspace
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySettings {
    pub workspace_id: String,
    pub auto_extract_enabled: bool,
    pub extraction_model: Option<String>,
    pub embedding_model: String,
    pub max_memories: i32,
    pub context_injection_count: i32,
    pub similarity_threshold: f64,
    pub created_at: String,
    pub updated_at: String,
}

/// Memory statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStats {
    pub total_count: i32,
    pub auto_count: i32,
    pub user_count: i32,
    pub conversation_count: i32,
    pub pinned_count: i32,
    pub with_embeddings: i32,
    pub avg_importance: f64,
}

/// Input for creating a memory
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMemoryInput {
    pub content: String,
    pub summary: Option<String>,
    pub memory_type: Option<String>,
    pub tags: Option<Vec<String>>,
    pub importance: Option<i32>,
    pub is_pinned: Option<bool>,
    pub source_conversation_id: Option<String>,
    pub source_message_ids: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>,
}

/// Input for updating a memory
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMemoryInput {
    pub content: Option<String>,
    pub summary: Option<String>,
    pub tags: Option<Vec<String>>,
    pub importance: Option<i32>,
    pub is_pinned: Option<bool>,
    pub metadata: Option<serde_json::Value>,
}

/// Filters for listing memories
#[derive(Debug, Clone, Default)]
pub struct MemoryFilters {
    pub memory_type: Option<String>,
    pub tags: Option<Vec<String>>,
    pub is_pinned: Option<bool>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub sort_by: Option<String>,
}

/// Memory database manager
pub struct MemoryManager {
    db_path: PathBuf,
    workspace_id: String,
}

impl MemoryManager {
    /// Create a new memory manager for the given workspace
    pub fn new(workspace_root: &Path) -> Result<Self, String> {
        let sentinelops_dir = workspace_root.join(".sentinelops");
        std::fs::create_dir_all(&sentinelops_dir)
            .map_err(|e| format!("Failed to create .sentinelops directory: {}", e))?;

        let db_path = sentinelops_dir.join("memory.db");
        let workspace_id = Self::generate_workspace_id(workspace_root);

        let manager = Self {
            db_path,
            workspace_id,
        };

        manager.init_database()?;
        Ok(manager)
    }

    /// Generate a unique ID for a workspace based on its path
    fn generate_workspace_id(path: &Path) -> String {
        let mut hasher = Sha256::new();
        hasher.update(path.to_string_lossy().as_bytes());
        let hash = hasher.finalize();
        hex::encode(&hash[..8])
    }

    /// Get the workspace ID
    pub fn workspace_id(&self) -> &str {
        &self.workspace_id
    }

    /// Open a connection to the database
    fn get_connection(&self) -> Result<Connection, String> {
        Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to open database: {}", e))
    }

    /// Initialize the database schema
    fn init_database(&self) -> Result<(), String> {
        let conn = self.get_connection()?;

        conn.execute_batch(r#"
            -- Core memories table
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                content TEXT NOT NULL,
                summary TEXT,
                type TEXT NOT NULL CHECK(type IN ('auto', 'user', 'conversation')),
                source_conversation_id TEXT,
                source_message_ids TEXT,
                embedding BLOB,
                embedding_model TEXT,
                tags TEXT,
                importance INTEGER DEFAULT 5,
                access_count INTEGER DEFAULT 0,
                last_accessed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                expires_at TEXT,
                is_pinned INTEGER DEFAULT 0,
                metadata TEXT
            );

            -- Indexes for efficient queries
            CREATE INDEX IF NOT EXISTS idx_memories_workspace ON memories(workspace_id);
            CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
            CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
            CREATE INDEX IF NOT EXISTS idx_memories_pinned ON memories(is_pinned DESC, importance DESC);

            -- Full-text search table for keyword fallback
            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                content,
                summary,
                tags,
                content=memories,
                content_rowid=rowid
            );

            -- Settings table for memory system configuration
            CREATE TABLE IF NOT EXISTS memory_settings (
                workspace_id TEXT PRIMARY KEY,
                auto_extract_enabled INTEGER DEFAULT 1,
                extraction_model TEXT,
                embedding_model TEXT DEFAULT 'openai/text-embedding-3-small',
                max_memories INTEGER DEFAULT 1000,
                context_injection_count INTEGER DEFAULT 5,
                similarity_threshold REAL DEFAULT 0.7,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        "#).map_err(|e| format!("Failed to create tables: {}", e))?;

        // Create FTS triggers if they don't exist
        // Note: SQLite doesn't support IF NOT EXISTS for triggers, so we check manually
        let trigger_exists: bool = conn
            .query_row(
                "SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='memories_ai'",
                [],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !trigger_exists {
            conn.execute_batch(r#"
                CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
                    INSERT INTO memories_fts(rowid, content, summary, tags)
                    VALUES (NEW.rowid, NEW.content, NEW.summary, NEW.tags);
                END;

                CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
                    INSERT INTO memories_fts(memories_fts, rowid, content, summary, tags)
                    VALUES ('delete', OLD.rowid, OLD.content, OLD.summary, OLD.tags);
                END;

                CREATE TRIGGER memories_au AFTER UPDATE ON memories BEGIN
                    INSERT INTO memories_fts(memories_fts, rowid, content, summary, tags)
                    VALUES ('delete', OLD.rowid, OLD.content, OLD.summary, OLD.tags);
                    INSERT INTO memories_fts(rowid, content, summary, tags)
                    VALUES (NEW.rowid, NEW.content, NEW.summary, NEW.tags);
                END;
            "#).map_err(|e| format!("Failed to create triggers: {}", e))?;
        }

        // Initialize settings for this workspace if not exists
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR IGNORE INTO memory_settings (workspace_id, created_at, updated_at) VALUES (?1, ?2, ?2)",
            params![&self.workspace_id, &now],
        ).map_err(|e| format!("Failed to initialize settings: {}", e))?;

        Ok(())
    }

    /// Create a new memory
    pub fn create_memory(&self, input: CreateMemoryInput) -> Result<Memory, String> {
        let conn = self.get_connection()?;
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let memory_type = input.memory_type.unwrap_or_else(|| "user".to_string());
        let importance = input.importance.unwrap_or(5);
        let is_pinned = input.is_pinned.unwrap_or(false);

        let tags_json = input.tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default());
        let message_ids_json = input.source_message_ids.as_ref().map(|m| serde_json::to_string(m).unwrap_or_default());
        let metadata_json = input.metadata.as_ref().map(|m| serde_json::to_string(m).unwrap_or_default());

        conn.execute(
            r#"INSERT INTO memories (
                id, workspace_id, content, summary, type, source_conversation_id,
                source_message_ids, tags, importance, is_pinned, metadata, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)"#,
            params![
                &id,
                &self.workspace_id,
                &input.content,
                &input.summary,
                &memory_type,
                &input.source_conversation_id,
                &message_ids_json,
                &tags_json,
                importance,
                is_pinned as i32,
                &metadata_json,
                &now,
            ],
        ).map_err(|e| format!("Failed to create memory: {}", e))?;

        self.get_memory(&id)?.ok_or_else(|| "Memory not found after creation".to_string())
    }

    /// Get a memory by ID
    pub fn get_memory(&self, id: &str) -> Result<Option<Memory>, String> {
        let conn = self.get_connection()?;

        let result = conn.query_row(
            r#"SELECT
                id, workspace_id, content, summary, type, source_conversation_id,
                source_message_ids, embedding_model, tags, importance, access_count,
                last_accessed_at, created_at, updated_at, expires_at, is_pinned, metadata
            FROM memories WHERE id = ?1 AND workspace_id = ?2"#,
            params![id, &self.workspace_id],
            |row| self.row_to_memory(row),
        ).optional().map_err(|e| format!("Failed to get memory: {}", e))?;

        Ok(result)
    }

    /// Update a memory
    pub fn update_memory(&self, id: &str, input: UpdateMemoryInput) -> Result<Memory, String> {
        let conn = self.get_connection()?;
        let now = Utc::now().to_rfc3339();

        let existing = self.get_memory(id)?
            .ok_or_else(|| "Memory not found".to_string())?;

        let content = input.content.unwrap_or(existing.content);
        let summary = input.summary.or(existing.summary);
        let tags = input.tags.or(existing.tags);
        let importance = input.importance.unwrap_or(existing.importance);
        let is_pinned = input.is_pinned.unwrap_or(existing.is_pinned);
        let metadata = input.metadata.or(existing.metadata);

        let tags_json = tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default());
        let metadata_json = metadata.as_ref().map(|m| serde_json::to_string(m).unwrap_or_default());

        conn.execute(
            r#"UPDATE memories SET
                content = ?1, summary = ?2, tags = ?3, importance = ?4,
                is_pinned = ?5, metadata = ?6, updated_at = ?7
            WHERE id = ?8 AND workspace_id = ?9"#,
            params![
                &content,
                &summary,
                &tags_json,
                importance,
                is_pinned as i32,
                &metadata_json,
                &now,
                id,
                &self.workspace_id,
            ],
        ).map_err(|e| format!("Failed to update memory: {}", e))?;

        self.get_memory(id)?.ok_or_else(|| "Memory not found after update".to_string())
    }

    /// Delete a memory
    pub fn delete_memory(&self, id: &str) -> Result<bool, String> {
        let conn = self.get_connection()?;

        let deleted = conn.execute(
            "DELETE FROM memories WHERE id = ?1 AND workspace_id = ?2",
            params![id, &self.workspace_id],
        ).map_err(|e| format!("Failed to delete memory: {}", e))?;

        Ok(deleted > 0)
    }

    /// List memories with optional filters
    pub fn list_memories(&self, filters: MemoryFilters) -> Result<(Vec<Memory>, usize), String> {
        let conn = self.get_connection()?;

        // Build query
        let mut conditions = vec!["workspace_id = ?1".to_string()];
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(self.workspace_id.clone())];

        if let Some(ref memory_type) = filters.memory_type {
            if memory_type == "pinned" {
                conditions.push("is_pinned = 1".to_string());
            } else {
                conditions.push(format!("type = ?{}", params_vec.len() + 1));
                params_vec.push(Box::new(memory_type.clone()));
            }
        }

        if let Some(is_pinned) = filters.is_pinned {
            conditions.push(format!("is_pinned = ?{}", params_vec.len() + 1));
            params_vec.push(Box::new(is_pinned as i32));
        }

        let where_clause = conditions.join(" AND ");

        let order_by = match filters.sort_by.as_deref() {
            Some("importance") => "importance DESC, created_at DESC",
            Some("accessed") => "COALESCE(last_accessed_at, created_at) DESC",
            _ => "created_at DESC",
        };

        let limit = filters.limit.unwrap_or(100);
        let offset = filters.offset.unwrap_or(0);

        // Get total count
        let count_sql = format!("SELECT COUNT(*) FROM memories WHERE {}", where_clause);
        let total: usize = {
            let mut stmt = conn.prepare(&count_sql)
                .map_err(|e| format!("Failed to prepare count query: {}", e))?;
            let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
            stmt.query_row(params_refs.as_slice(), |row| row.get(0))
                .map_err(|e| format!("Failed to get count: {}", e))?
        };

        // Get memories
        let sql = format!(
            r#"SELECT
                id, workspace_id, content, summary, type, source_conversation_id,
                source_message_ids, embedding_model, tags, importance, access_count,
                last_accessed_at, created_at, updated_at, expires_at, is_pinned, metadata
            FROM memories WHERE {} ORDER BY {} LIMIT {} OFFSET {}"#,
            where_clause, order_by, limit, offset
        );

        let mut stmt = conn.prepare(&sql)
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let memories = stmt.query_map(params_refs.as_slice(), |row| self.row_to_memory(row))
            .map_err(|e| format!("Failed to query memories: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        Ok((memories, total))
    }

    /// Search memories using FTS5 keyword search
    pub fn search_keyword(&self, query: &str, limit: usize) -> Result<Vec<MemoryWithScore>, String> {
        let conn = self.get_connection()?;

        let sql = r#"
            SELECT m.id, m.workspace_id, m.content, m.summary, m.type, m.source_conversation_id,
                m.source_message_ids, m.embedding_model, m.tags, m.importance, m.access_count,
                m.last_accessed_at, m.created_at, m.updated_at, m.expires_at, m.is_pinned, m.metadata,
                bm25(memories_fts) as score
            FROM memories_fts
            JOIN memories m ON memories_fts.rowid = m.rowid
            WHERE memories_fts MATCH ?1 AND m.workspace_id = ?2
            ORDER BY bm25(memories_fts)
            LIMIT ?3
        "#;

        let mut stmt = conn.prepare(sql)
            .map_err(|e| format!("Failed to prepare search query: {}", e))?;

        let results = stmt.query_map(params![query, &self.workspace_id, limit as i64], |row| {
            let memory = self.row_to_memory(row)?;
            let score: f64 = row.get(17)?;
            Ok(MemoryWithScore {
                memory,
                score: -score, // BM25 returns negative scores, lower is better
                match_type: "keyword".to_string(),
            })
        })
        .map_err(|e| format!("Failed to search: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

        Ok(results)
    }

    /// Search memories using semantic similarity (cosine similarity on embeddings)
    pub fn search_semantic(&self, query_embedding: &[f32], limit: usize, threshold: f64) -> Result<Vec<MemoryWithScore>, String> {
        let conn = self.get_connection()?;

        // Get all memories with embeddings
        let sql = r#"
            SELECT id, workspace_id, content, summary, type, source_conversation_id,
                source_message_ids, embedding_model, tags, importance, access_count,
                last_accessed_at, created_at, updated_at, expires_at, is_pinned, metadata, embedding
            FROM memories
            WHERE workspace_id = ?1 AND embedding IS NOT NULL
        "#;

        let mut stmt = conn.prepare(sql)
            .map_err(|e| format!("Failed to prepare semantic search query: {}", e))?;

        let mut results: Vec<MemoryWithScore> = stmt.query_map(params![&self.workspace_id], |row| {
            let memory = self.row_to_memory(row)?;
            let embedding_blob: Vec<u8> = row.get(17)?;

            // Convert blob to f32 vector
            let embedding = bytes_to_f32_vec(&embedding_blob);
            let score = cosine_similarity(query_embedding, &embedding);

            Ok(MemoryWithScore {
                memory,
                score,
                match_type: "semantic".to_string(),
            })
        })
        .map_err(|e| format!("Failed to search: {}", e))?
        .filter_map(|r| r.ok())
        .filter(|r| r.score >= threshold)
        .collect();

        // Sort by score descending
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(limit);

        Ok(results)
    }

    /// Hybrid search: tries semantic first, falls back to keyword
    pub fn search_hybrid(&self, query: &str, query_embedding: Option<&[f32]>, limit: usize, threshold: f64) -> Result<Vec<MemoryWithScore>, String> {
        // Try semantic search first if embedding available
        if let Some(emb) = query_embedding {
            let semantic_results = self.search_semantic(emb, limit, threshold)?;
            if !semantic_results.is_empty() {
                return Ok(semantic_results);
            }
        }

        // Fall back to keyword search
        self.search_keyword(query, limit)
    }

    /// Store an embedding for a memory
    pub fn store_embedding(&self, memory_id: &str, embedding: &[f32], model: &str) -> Result<(), String> {
        let conn = self.get_connection()?;
        let now = Utc::now().to_rfc3339();

        // Convert f32 vector to bytes
        let embedding_bytes = f32_vec_to_bytes(embedding);

        conn.execute(
            "UPDATE memories SET embedding = ?1, embedding_model = ?2, updated_at = ?3 WHERE id = ?4 AND workspace_id = ?5",
            params![&embedding_bytes, model, &now, memory_id, &self.workspace_id],
        ).map_err(|e| format!("Failed to store embedding: {}", e))?;

        Ok(())
    }

    /// Increment access count for a memory
    pub fn increment_access(&self, memory_id: &str) -> Result<(), String> {
        let conn = self.get_connection()?;
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE memories SET access_count = access_count + 1, last_accessed_at = ?1 WHERE id = ?2 AND workspace_id = ?3",
            params![&now, memory_id, &self.workspace_id],
        ).map_err(|e| format!("Failed to increment access: {}", e))?;

        Ok(())
    }

    /// Get memory settings
    pub fn get_settings(&self) -> Result<MemorySettings, String> {
        let conn = self.get_connection()?;

        conn.query_row(
            r#"SELECT workspace_id, auto_extract_enabled, extraction_model, embedding_model,
                max_memories, context_injection_count, similarity_threshold, created_at, updated_at
            FROM memory_settings WHERE workspace_id = ?1"#,
            params![&self.workspace_id],
            |row| {
                Ok(MemorySettings {
                    workspace_id: row.get(0)?,
                    auto_extract_enabled: row.get::<_, i32>(1)? != 0,
                    extraction_model: row.get(2)?,
                    embedding_model: row.get(3)?,
                    max_memories: row.get(4)?,
                    context_injection_count: row.get(5)?,
                    similarity_threshold: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            },
        ).map_err(|e| format!("Failed to get settings: {}", e))
    }

    /// Update memory settings
    pub fn update_settings(
        &self,
        auto_extract_enabled: Option<bool>,
        extraction_model: Option<String>,
        embedding_model: Option<String>,
        max_memories: Option<i32>,
        context_injection_count: Option<i32>,
        similarity_threshold: Option<f64>,
    ) -> Result<MemorySettings, String> {
        let conn = self.get_connection()?;
        let now = Utc::now().to_rfc3339();
        let current = self.get_settings()?;

        conn.execute(
            r#"UPDATE memory_settings SET
                auto_extract_enabled = ?1, extraction_model = ?2, embedding_model = ?3,
                max_memories = ?4, context_injection_count = ?5, similarity_threshold = ?6,
                updated_at = ?7
            WHERE workspace_id = ?8"#,
            params![
                auto_extract_enabled.unwrap_or(current.auto_extract_enabled) as i32,
                extraction_model.or(current.extraction_model),
                embedding_model.unwrap_or(current.embedding_model),
                max_memories.unwrap_or(current.max_memories),
                context_injection_count.unwrap_or(current.context_injection_count),
                similarity_threshold.unwrap_or(current.similarity_threshold),
                &now,
                &self.workspace_id,
            ],
        ).map_err(|e| format!("Failed to update settings: {}", e))?;

        self.get_settings()
    }

    /// Get memory statistics
    pub fn get_stats(&self) -> Result<MemoryStats, String> {
        let conn = self.get_connection()?;

        let total_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM memories WHERE workspace_id = ?1",
            params![&self.workspace_id],
            |row| row.get(0),
        ).unwrap_or(0);

        let auto_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM memories WHERE workspace_id = ?1 AND type = 'auto'",
            params![&self.workspace_id],
            |row| row.get(0),
        ).unwrap_or(0);

        let user_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM memories WHERE workspace_id = ?1 AND type = 'user'",
            params![&self.workspace_id],
            |row| row.get(0),
        ).unwrap_or(0);

        let conversation_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM memories WHERE workspace_id = ?1 AND type = 'conversation'",
            params![&self.workspace_id],
            |row| row.get(0),
        ).unwrap_or(0);

        let pinned_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM memories WHERE workspace_id = ?1 AND is_pinned = 1",
            params![&self.workspace_id],
            |row| row.get(0),
        ).unwrap_or(0);

        let with_embeddings: i32 = conn.query_row(
            "SELECT COUNT(*) FROM memories WHERE workspace_id = ?1 AND embedding IS NOT NULL",
            params![&self.workspace_id],
            |row| row.get(0),
        ).unwrap_or(0);

        let avg_importance: f64 = conn.query_row(
            "SELECT COALESCE(AVG(importance), 0) FROM memories WHERE workspace_id = ?1",
            params![&self.workspace_id],
            |row| row.get(0),
        ).unwrap_or(0.0);

        Ok(MemoryStats {
            total_count,
            auto_count,
            user_count,
            conversation_count,
            pinned_count,
            with_embeddings,
            avg_importance,
        })
    }

    /// Convert a database row to a Memory struct
    fn row_to_memory(&self, row: &rusqlite::Row) -> Result<Memory, rusqlite::Error> {
        let tags_json: Option<String> = row.get(8)?;
        let message_ids_json: Option<String> = row.get(6)?;
        let metadata_json: Option<String> = row.get(16)?;

        Ok(Memory {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            content: row.get(2)?,
            summary: row.get(3)?,
            memory_type: MemoryType::from_str(&row.get::<_, String>(4)?),
            source_conversation_id: row.get(5)?,
            source_message_ids: message_ids_json.and_then(|j| serde_json::from_str(&j).ok()),
            embedding_model: row.get(7)?,
            tags: tags_json.and_then(|j| serde_json::from_str(&j).ok()),
            importance: row.get(9)?,
            access_count: row.get(10)?,
            last_accessed_at: row.get(11)?,
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
            expires_at: row.get(14)?,
            is_pinned: row.get::<_, i32>(15)? != 0,
            metadata: metadata_json.and_then(|j| serde_json::from_str(&j).ok()),
        })
    }
}

/// Calculate cosine similarity between two vectors
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let dot_product: f64 = a.iter().zip(b.iter()).map(|(x, y)| (*x as f64) * (*y as f64)).sum();
    let norm_a: f64 = a.iter().map(|x| (*x as f64).powi(2)).sum::<f64>().sqrt();
    let norm_b: f64 = b.iter().map(|x| (*x as f64).powi(2)).sum::<f64>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        0.0
    } else {
        dot_product / (norm_a * norm_b)
    }
}

/// Convert f32 vector to bytes for storage
fn f32_vec_to_bytes(vec: &[f32]) -> Vec<u8> {
    vec.iter().flat_map(|f| f.to_le_bytes()).collect()
}

/// Convert bytes back to f32 vector
fn bytes_to_f32_vec(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks(4)
        .filter_map(|chunk| {
            if chunk.len() == 4 {
                Some(f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
            } else {
                None
            }
        })
        .collect()
}
