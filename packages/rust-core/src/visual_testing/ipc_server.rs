//! IPC communication interface for visual regression testing
//! 
//! This module provides a local static server for serving images and optimized
//! IPC communication between Rust Core and the React frontend.

use crate::visual_testing::{VisualError, VisualResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::oneshot;

/// Configuration for the IPC server
#[derive(Debug, Clone)]
pub struct IpcServerConfig {
    /// Port to bind to (0 = auto-select)
    pub port: u16,
    /// Host to bind to
    pub host: String,
    /// Maximum number of concurrent connections
    pub max_connections: usize,
    /// Timeout for serving files (seconds)
    pub serve_timeout_secs: u64,
    /// Automatic cleanup interval (seconds)
    pub cleanup_interval_secs: u64,
    /// Maximum file age before cleanup (seconds)
    pub max_file_age_secs: u64,
}

impl Default for IpcServerConfig {
    fn default() -> Self {
        Self {
            port: 0, // Auto-select port
            host: "127.0.0.1".to_string(),
            max_connections: 10,
            serve_timeout_secs: 300, // 5 minutes
            cleanup_interval_secs: 60, // 1 minute
            max_file_age_secs: 3600, // 1 hour
        }
    }
}

/// Information about a served file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServedFile {
    /// Unique identifier for the file
    pub id: String,
    /// Original file path
    pub original_path: PathBuf,
    /// Temporary file path (if copied)
    pub temp_path: Option<PathBuf>,
    /// MIME type
    pub mime_type: String,
    /// File size in bytes
    pub size_bytes: u64,
    /// When the file was registered for serving
    pub registered_at: u64,
    /// Number of times accessed
    pub access_count: u64,
    /// Last access time
    pub last_accessed: u64,
}

impl ServedFile {
    pub fn new(id: String, original_path: PathBuf, mime_type: String, size_bytes: u64) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Self {
            id,
            original_path,
            temp_path: None,
            mime_type,
            size_bytes,
            registered_at: now,
            access_count: 0,
            last_accessed: now,
        }
    }

    pub fn with_temp_path(mut self, temp_path: PathBuf) -> Self {
        self.temp_path = Some(temp_path);
        self
    }

    pub fn get_serve_path(&self) -> &Path {
        self.temp_path.as_ref().unwrap_or(&self.original_path)
    }

    pub fn record_access(&mut self) {
        self.access_count += 1;
        self.last_accessed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
    }

    pub fn is_expired(&self, max_age_secs: u64) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        now - self.last_accessed > max_age_secs
    }
}

/// Local static server for serving images via HTTP
pub struct LocalImageServer {
    config: IpcServerConfig,
    served_files: Arc<Mutex<HashMap<String, ServedFile>>>,
    server_addr: Option<SocketAddr>,
    shutdown_tx: Option<oneshot::Sender<()>>,
}

impl LocalImageServer {
    /// Create a new local image server
    pub fn new(config: IpcServerConfig) -> Self {
        Self {
            config,
            served_files: Arc::new(Mutex::new(HashMap::new())),
            server_addr: None,
            shutdown_tx: None,
        }
    }

    /// Start the server and return the bound address
    pub fn start(&mut self) -> VisualResult<SocketAddr> {
        let listener = TcpListener::bind(format!("{}:{}", self.config.host, self.config.port))
            .map_err(|e| VisualError::IoError {
                message: format!("Failed to bind server: {}", e),
            })?;

        let addr = listener.local_addr().map_err(|e| VisualError::IoError {
            message: format!("Failed to get server address: {}", e),
        })?;

        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let served_files = Arc::clone(&self.served_files);
        let config = self.config.clone();

        // Start server in background thread
        thread::spawn(move || {
            Self::run_server(listener, served_files, config, shutdown_rx);
        });

        self.server_addr = Some(addr);
        self.shutdown_tx = Some(shutdown_tx);

        // Start cleanup task
        self.start_cleanup_task();

        Ok(addr)
    }

    /// Stop the server
    pub fn stop(&mut self) -> VisualResult<()> {
        if let Some(shutdown_tx) = self.shutdown_tx.take() {
            let _ = shutdown_tx.send(());
        }

        // Clean up all served files
        self.cleanup_all_files()?;

        Ok(())
    }

    /// Register a file for serving and return the URL
    pub fn serve_file<P: AsRef<Path>>(&self, file_path: P) -> VisualResult<String> {
        let file_path = file_path.as_ref();
        
        if !file_path.exists() {
            return Err(VisualError::FileSystemError {
                operation: "serve_file".to_string(),
                path: file_path.display().to_string(),
                reason: "File does not exist".to_string(),
            });
        }

        let metadata = fs::metadata(file_path).map_err(|e| VisualError::FileSystemError {
            operation: "get_file_metadata".to_string(),
            path: file_path.display().to_string(),
            reason: e.to_string(),
        })?;

        let file_id = self.generate_file_id(file_path);
        let mime_type = self.detect_mime_type(file_path);
        
        let served_file = ServedFile::new(
            file_id.clone(),
            file_path.to_path_buf(),
            mime_type,
            metadata.len(),
        );

        // Store the file info
        {
            let mut files = self.served_files.lock().unwrap();
            files.insert(file_id.clone(), served_file);
        }

        // Generate URL
        let addr = self.server_addr.ok_or_else(|| VisualError::ConfigError {
            message: "Server not started".to_string(),
        })?;

        Ok(format!("http://{}:{}/image/{}", addr.ip(), addr.port(), file_id))
    }

    /// Register a file with custom content (creates temporary file)
    pub fn serve_content(&self, content: &[u8], filename: &str) -> VisualResult<String> {
        let temp_dir = std::env::temp_dir().join("geniusqa_visual_testing");
        fs::create_dir_all(&temp_dir).map_err(|e| VisualError::FileSystemError {
            operation: "create_temp_directory".to_string(),
            path: temp_dir.display().to_string(),
            reason: e.to_string(),
        })?;

        let file_id = self.generate_content_id(content, filename);
        let temp_path = temp_dir.join(&file_id);

        // Write content to temporary file
        fs::write(&temp_path, content).map_err(|e| VisualError::FileSystemError {
            operation: "write_temp_file".to_string(),
            path: temp_path.display().to_string(),
            reason: e.to_string(),
        })?;

        let mime_type = self.detect_mime_type(&temp_path);
        
        let served_file = ServedFile::new(
            file_id.clone(),
            PathBuf::from(filename),
            mime_type,
            content.len() as u64,
        ).with_temp_path(temp_path);

        // Store the file info
        {
            let mut files = self.served_files.lock().unwrap();
            files.insert(file_id.clone(), served_file);
        }

        // Generate URL
        let addr = self.server_addr.ok_or_else(|| VisualError::ConfigError {
            message: "Server not started".to_string(),
        })?;

        Ok(format!("http://{}:{}/image/{}", addr.ip(), addr.port(), file_id))
    }

    /// Get statistics about served files
    pub fn get_server_stats(&self) -> ServerStats {
        let files = self.served_files.lock().unwrap();
        
        let total_files = files.len();
        let total_size: u64 = files.values().map(|f| f.size_bytes).sum();
        let total_accesses: u64 = files.values().map(|f| f.access_count).sum();
        
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        let expired_files = files.values()
            .filter(|f| f.is_expired(self.config.max_file_age_secs))
            .count();

        ServerStats {
            total_files,
            total_size_bytes: total_size,
            total_accesses,
            expired_files,
            server_uptime_secs: now - files.values()
                .map(|f| f.registered_at)
                .min()
                .unwrap_or(now),
        }
    }

    /// Clean up expired files
    pub fn cleanup_expired_files(&self) -> VisualResult<usize> {
        let mut files = self.served_files.lock().unwrap();
        let mut removed_count = 0;
        
        let expired_ids: Vec<String> = files.iter()
            .filter(|(_, file)| file.is_expired(self.config.max_file_age_secs))
            .map(|(id, _)| id.clone())
            .collect();

        for id in expired_ids {
            if let Some(file) = files.remove(&id) {
                // Remove temporary file if it exists
                if let Some(temp_path) = &file.temp_path {
                    let _ = fs::remove_file(temp_path);
                }
                removed_count += 1;
            }
        }

        Ok(removed_count)
    }

    /// Clean up all files
    pub fn cleanup_all_files(&self) -> VisualResult<()> {
        let mut files = self.served_files.lock().unwrap();
        
        // Remove all temporary files
        for file in files.values() {
            if let Some(temp_path) = &file.temp_path {
                let _ = fs::remove_file(temp_path);
            }
        }
        
        files.clear();
        Ok(())
    }

    /// Generate a unique file ID
    fn generate_file_id(&self, file_path: &Path) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        file_path.hash(&mut hasher);
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().hash(&mut hasher);
        
        format!("{:x}", hasher.finish())
    }

    /// Generate a unique content ID
    fn generate_content_id(&self, content: &[u8], filename: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        filename.hash(&mut hasher);
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().hash(&mut hasher);
        
        format!("{:x}", hasher.finish())
    }

    /// Detect MIME type from file extension
    fn detect_mime_type(&self, file_path: &Path) -> String {
        match file_path.extension().and_then(|ext| ext.to_str()) {
            Some("png") => "image/png".to_string(),
            Some("jpg") | Some("jpeg") => "image/jpeg".to_string(),
            Some("webp") => "image/webp".to_string(),
            Some("gif") => "image/gif".to_string(),
            Some("bmp") => "image/bmp".to_string(),
            Some("svg") => "image/svg+xml".to_string(),
            _ => "application/octet-stream".to_string(),
        }
    }

    /// Start the cleanup task
    fn start_cleanup_task(&self) {
        let served_files = Arc::clone(&self.served_files);
        let cleanup_interval = Duration::from_secs(self.config.cleanup_interval_secs);
        let max_file_age = self.config.max_file_age_secs;

        thread::spawn(move || {
            loop {
                thread::sleep(cleanup_interval);
                
                // Perform cleanup
                let mut files = served_files.lock().unwrap();
                let expired_ids: Vec<String> = files.iter()
                    .filter(|(_, file)| file.is_expired(max_file_age))
                    .map(|(id, _)| id.clone())
                    .collect();

                for id in expired_ids {
                    if let Some(file) = files.remove(&id) {
                        if let Some(temp_path) = &file.temp_path {
                            let _ = fs::remove_file(temp_path);
                        }
                    }
                }
            }
        });
    }

    /// Run the HTTP server
    fn run_server(
        listener: TcpListener,
        served_files: Arc<Mutex<HashMap<String, ServedFile>>>,
        _config: IpcServerConfig,
        mut shutdown_rx: oneshot::Receiver<()>,
    ) {

        listener.set_nonblocking(true).unwrap();

        loop {
            // Check for shutdown signal
            if shutdown_rx.try_recv().is_ok() {
                break;
            }

            // Accept connections
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let served_files = Arc::clone(&served_files);
                    
                    thread::spawn(move || {
                        let mut buffer = [0; 1024];
                        if let Ok(size) = stream.read(&mut buffer) {
                            let request = String::from_utf8_lossy(&buffer[..size]);
                            
                            if let Some(file_id) = Self::parse_file_id_from_request(&request) {
                                Self::serve_file_response(&mut stream, &file_id, served_files);
                            } else {
                                Self::send_404_response(&mut stream);
                            }
                        }
                    });
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // No connection available, sleep briefly
                    thread::sleep(Duration::from_millis(10));
                }
                Err(_) => {
                    // Error accepting connection, continue
                    continue;
                }
            }
        }
    }

    /// Parse file ID from HTTP request
    fn parse_file_id_from_request(request: &str) -> Option<String> {
        // Simple HTTP request parsing
        let lines: Vec<&str> = request.lines().collect();
        if let Some(first_line) = lines.first() {
            let parts: Vec<&str> = first_line.split_whitespace().collect();
            if parts.len() >= 2 && parts[0] == "GET" {
                let path = parts[1];
                if path.starts_with("/image/") {
                    return Some(path[7..].to_string()); // Remove "/image/" prefix
                }
            }
        }
        None
    }

    /// Serve a file response
    fn serve_file_response(
        stream: &mut std::net::TcpStream,
        file_id: &str,
        served_files: Arc<Mutex<HashMap<String, ServedFile>>>,
    ) {
        let mut files = served_files.lock().unwrap();
        
        if let Some(file) = files.get_mut(file_id) {
            file.record_access();
            
            let file_path = file.get_serve_path();
            
            match fs::read(file_path) {
                Ok(content) => {
                    let response = format!(
                        "HTTP/1.1 200 OK\r\n\
                         Content-Type: {}\r\n\
                         Content-Length: {}\r\n\
                         Access-Control-Allow-Origin: *\r\n\
                         Cache-Control: public, max-age=3600\r\n\
                         \r\n",
                        file.mime_type,
                        content.len()
                    );
                    
                    let _ = stream.write_all(response.as_bytes());
                    let _ = stream.write_all(&content);
                }
                Err(_) => {
                    Self::send_404_response(stream);
                }
            }
        } else {
            Self::send_404_response(stream);
        }
    }

    /// Send 404 Not Found response
    fn send_404_response(stream: &mut std::net::TcpStream) {
        let response = "HTTP/1.1 404 Not Found\r\n\
                       Content-Type: text/plain\r\n\
                       Content-Length: 9\r\n\
                       \r\n\
                       Not Found";
        let _ = stream.write_all(response.as_bytes());
    }
}

impl Drop for LocalImageServer {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

/// Server statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStats {
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub total_accesses: u64,
    pub expired_files: usize,
    pub server_uptime_secs: u64,
}

impl ServerStats {
    pub fn total_size_mb(&self) -> f64 {
        self.total_size_bytes as f64 / (1024.0 * 1024.0)
    }

    pub fn average_file_size_bytes(&self) -> u64 {
        if self.total_files > 0 {
            self.total_size_bytes / self.total_files as u64
        } else {
            0
        }
    }
}

/// IPC message types for communication with frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum IpcMessage {
    /// Request to serve a file
    ServeFile {
        file_path: String,
    },
    /// Response with file URL
    FileServed {
        url: String,
        file_id: String,
    },
    /// Request server statistics
    GetServerStats,
    /// Server statistics response
    ServerStats(ServerStats),
    /// Request to cleanup expired files
    CleanupExpired,
    /// Cleanup result
    CleanupResult {
        removed_count: usize,
    },
    /// Error response
    Error {
        message: String,
        error_type: String,
    },
}

/// IPC handler for processing messages
pub struct IpcHandler {
    server: LocalImageServer,
}

impl IpcHandler {
    /// Create a new IPC handler
    pub fn new(config: IpcServerConfig) -> VisualResult<Self> {
        let mut server = LocalImageServer::new(config);
        server.start()?;
        
        Ok(Self { server })
    }

    /// Process an IPC message and return response
    pub fn handle_message(&self, message: IpcMessage) -> IpcMessage {
        match message {
            IpcMessage::ServeFile { file_path } => {
                match self.server.serve_file(&file_path) {
                    Ok(url) => {
                        let file_id = url.split('/').last().unwrap_or("").to_string();
                        IpcMessage::FileServed { url, file_id }
                    }
                    Err(e) => IpcMessage::Error {
                        message: e.to_string(),
                        error_type: format!("{:?}", e),
                    },
                }
            }
            IpcMessage::GetServerStats => {
                let stats = self.server.get_server_stats();
                IpcMessage::ServerStats(stats)
            }
            IpcMessage::CleanupExpired => {
                match self.server.cleanup_expired_files() {
                    Ok(removed_count) => IpcMessage::CleanupResult { removed_count },
                    Err(e) => IpcMessage::Error {
                        message: e.to_string(),
                        error_type: format!("{:?}", e),
                    },
                }
            }
            _ => IpcMessage::Error {
                message: "Unsupported message type".to_string(),
                error_type: "UnsupportedMessage".to_string(),
            },
        }
    }

    /// Get the server URL base
    pub fn get_server_base_url(&self) -> Option<String> {
        self.server.server_addr.map(|addr| {
            format!("http://{}:{}", addr.ip(), addr.port())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn test_server_creation() {
        let config = IpcServerConfig::default();
        let mut server = LocalImageServer::new(config);
        
        let addr = server.start().unwrap();
        assert!(addr.port() > 0);
        
        server.stop().unwrap();
    }

    #[test]
    fn test_file_serving() {
        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("test.png");
        
        // Create a test file
        let mut file = File::create(&test_file).unwrap();
        file.write_all(b"test image data").unwrap();
        
        let config = IpcServerConfig::default();
        let mut server = LocalImageServer::new(config);
        server.start().unwrap();
        
        let url = server.serve_file(&test_file).unwrap();
        assert!(url.starts_with("http://"));
        assert!(url.contains("/image/"));
        
        server.stop().unwrap();
    }

    #[test]
    fn test_content_serving() {
        let config = IpcServerConfig::default();
        let mut server = LocalImageServer::new(config);
        server.start().unwrap();
        
        let content = b"test image content";
        let url = server.serve_content(content, "test.png").unwrap();
        assert!(url.starts_with("http://"));
        assert!(url.contains("/image/"));
        
        server.stop().unwrap();
    }

    #[test]
    fn test_server_stats() {
        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("test.png");
        
        let mut file = File::create(&test_file).unwrap();
        file.write_all(b"test image data").unwrap();
        
        let config = IpcServerConfig::default();
        let mut server = LocalImageServer::new(config);
        server.start().unwrap();
        
        server.serve_file(&test_file).unwrap();
        
        let stats = server.get_server_stats();
        assert_eq!(stats.total_files, 1);
        assert!(stats.total_size_bytes > 0);
        
        server.stop().unwrap();
    }

    #[test]
    fn test_ipc_handler() {
        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("test.png");
        
        let mut file = File::create(&test_file).unwrap();
        file.write_all(b"test image data").unwrap();
        
        let config = IpcServerConfig::default();
        let handler = IpcHandler::new(config).unwrap();
        
        let message = IpcMessage::ServeFile {
            file_path: test_file.display().to_string(),
        };
        
        let response = handler.handle_message(message);
        match response {
            IpcMessage::FileServed { url, file_id } => {
                assert!(url.starts_with("http://"));
                assert!(!file_id.is_empty());
            }
            _ => panic!("Expected FileServed response"),
        }
    }
}
