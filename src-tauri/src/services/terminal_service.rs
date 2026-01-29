use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum TerminalError {
    #[error("Terminal not found: {0}")]
    NotFound(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Process error: {0}")]
    Process(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInfo {
    pub id: String,
    #[serde(rename = "isRunning")]
    pub is_running: bool,
    pub cwd: String,
    pub pid: Option<u32>,
}

struct TerminalInstance {
    child: Option<Child>,
    output: Arc<Mutex<String>>,
    cwd: String,
    is_running: bool,
}

pub struct TerminalManager {
    terminals: HashMap<String, TerminalInstance>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: HashMap::new(),
        }
    }

    /// Execute a command in a terminal
    pub fn execute(
        &mut self,
        command: &str,
        cwd: Option<&str>,
        terminal_id: Option<&str>,
        shell: Option<&str>,
    ) -> Result<(String, Option<u32>), TerminalError> {
        let id = terminal_id
            .map(String::from)
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let working_dir = cwd.unwrap_or(".").to_string();

        // Determine shell based on OS
        let (shell_cmd, shell_arg) = if cfg!(windows) {
            (
                shell.unwrap_or("cmd"),
                "/C",
            )
        } else {
            (
                shell.unwrap_or("sh"),
                "-c",
            )
        };

        let output = Arc::new(Mutex::new(String::new()));
        let output_clone = Arc::clone(&output);

        let mut child = Command::new(shell_cmd)
            .arg(shell_arg)
            .arg(command)
            .current_dir(&working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let pid = child.id();

        // Capture stdout
        if let Some(stdout) = child.stdout.take() {
            let output_stdout = Arc::clone(&output_clone);
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        let mut out = output_stdout.lock().unwrap();
                        out.push_str(&line);
                        out.push('\n');
                    }
                }
            });
        }

        // Capture stderr
        if let Some(stderr) = child.stderr.take() {
            let output_stderr = Arc::clone(&output_clone);
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        let mut out = output_stderr.lock().unwrap();
                        out.push_str(&line);
                        out.push('\n');
                    }
                }
            });
        }

        self.terminals.insert(
            id.clone(),
            TerminalInstance {
                child: Some(child),
                output,
                cwd: working_dir,
                is_running: true,
            },
        );

        Ok((id, Some(pid)))
    }

    /// Kill a terminal
    pub fn kill(&mut self, terminal_id: &str) -> Result<bool, TerminalError> {
        if let Some(terminal) = self.terminals.get_mut(terminal_id) {
            if let Some(ref mut child) = terminal.child {
                child.kill()?;
                terminal.is_running = false;
                return Ok(true);
            }
        }
        Err(TerminalError::NotFound(terminal_id.to_string()))
    }

    /// Get terminal output
    pub fn get_output(&mut self, terminal_id: &str) -> Result<(String, bool, String), TerminalError> {
        if let Some(terminal) = self.terminals.get_mut(terminal_id) {
            // Check if process is still running
            let is_running = if let Some(ref mut child) = terminal.child {
                match child.try_wait() {
                    Ok(Some(_)) => {
                        terminal.is_running = false;
                        false
                    }
                    Ok(None) => true,
                    Err(_) => false,
                }
            } else {
                false
            };

            terminal.is_running = is_running;

            let output = terminal.output.lock().unwrap().clone();
            let cwd = terminal.cwd.clone();

            Ok((output, is_running, cwd))
        } else {
            Err(TerminalError::NotFound(terminal_id.to_string()))
        }
    }

    /// List all terminals
    pub fn list(&self) -> Vec<TerminalInfo> {
        self.terminals
            .iter()
            .map(|(id, term)| TerminalInfo {
                id: id.clone(),
                is_running: term.is_running,
                cwd: term.cwd.clone(),
                pid: term.child.as_ref().map(|c| c.id()),
            })
            .collect()
    }

    /// Clean up finished terminals
    pub fn cleanup(&mut self) {
        self.terminals.retain(|_, term| term.is_running);
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}
