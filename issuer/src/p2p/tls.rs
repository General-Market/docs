//! TLS configuration for P2P transport
//!
//! Provides mutual TLS authentication between issuer nodes using
//! rustls with certificate-based authentication.

use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::Arc;

use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use rustls::{ClientConfig, RootCertStore, ServerConfig};
use tokio::net::TcpStream;
use tokio_rustls::{TlsAcceptor, TlsConnector, TlsStream};
use tracing::debug;

use common::error::Error;

/// TLS configuration for P2P connections
#[derive(Clone)]
pub struct TlsConfig {
    /// Client configuration (for outgoing connections)
    client_config: Arc<ClientConfig>,
    /// Server configuration (for incoming connections)
    server_config: Arc<ServerConfig>,
}

impl TlsConfig {
    /// Create a new TLS configuration from PEM files
    ///
    /// # Arguments
    /// * `cert_path` - Path to the certificate PEM file
    /// * `key_path` - Path to the private key PEM file
    /// * `ca_path` - Path to the CA certificate PEM file for verification
    pub fn from_pem_files(
        cert_path: impl AsRef<Path>,
        key_path: impl AsRef<Path>,
        ca_path: impl AsRef<Path>,
    ) -> Result<Self, Error> {
        // Load certificates
        let certs = load_certs(cert_path.as_ref())?;
        let key = load_key(key_path.as_ref())?;
        let ca_certs = load_certs(ca_path.as_ref())?;

        // Build root cert store for verification
        let mut root_store = RootCertStore::empty();
        for cert in &ca_certs {
            root_store
                .add(cert.clone())
                .map_err(|e| Error::P2PConnection(format!("Failed to add CA cert: {}", e)))?;
        }

        // Build client config with client authentication
        let client_config = ClientConfig::builder()
            .with_root_certificates(root_store.clone())
            .with_client_auth_cert(certs.clone(), key.clone_key())
            .map_err(|e| Error::P2PConnection(format!("Client config error: {}", e)))?;

        // Build server config with client verification
        let client_cert_verifier = rustls::server::WebPkiClientVerifier::builder(Arc::new(root_store))
            .build()
            .map_err(|e| Error::P2PConnection(format!("Verifier build error: {}", e)))?;

        let server_config = ServerConfig::builder()
            .with_client_cert_verifier(client_cert_verifier)
            .with_single_cert(certs, key)
            .map_err(|e| Error::P2PConnection(format!("Server config error: {}", e)))?;

        Ok(Self {
            client_config: Arc::new(client_config),
            server_config: Arc::new(server_config),
        })
    }

    /// Wrap a TCP stream with TLS
    ///
    /// # Arguments
    /// * `stream` - The TCP stream to wrap
    /// * `is_server` - Whether this is a server (accepting) or client (connecting) side
    pub async fn wrap_stream(&self, stream: TcpStream, is_server: bool) -> Result<TcpStream, Error> {
        // Note: In production, we'd return TlsStream, but for API compatibility
        // with the trait that expects TcpStream, we need a different approach.
        // For now, this is a placeholder that returns the unwrapped stream.
        // The actual TLS implementation would need trait modifications.

        debug!(is_server, "TLS handshake (placeholder - TLS not yet fully integrated)");

        // TODO: Properly integrate TLS when the trait supports it
        // For now, return the stream as-is (plaintext)
        Ok(stream)
    }

    /// Get a TLS connector for client connections
    pub fn connector(&self) -> TlsConnector {
        TlsConnector::from(self.client_config.clone())
    }

    /// Get a TLS acceptor for server connections
    pub fn acceptor(&self) -> TlsAcceptor {
        TlsAcceptor::from(self.server_config.clone())
    }

    /// Wrap a stream for client (outgoing) connection with proper TLS
    pub async fn connect_tls(
        &self,
        stream: TcpStream,
        server_name: &str,
    ) -> Result<TlsStream<TcpStream>, Error> {
        let connector = self.connector();
        let server_name = rustls::pki_types::ServerName::try_from(server_name.to_string())
            .map_err(|e| Error::P2PConnection(format!("Invalid server name: {}", e)))?;

        connector
            .connect(server_name, stream)
            .await
            .map(|s| TlsStream::Client(s))
            .map_err(|e| Error::P2PConnection(format!("TLS connect error: {}", e)))
    }

    /// Wrap a stream for server (incoming) connection with proper TLS
    pub async fn accept_tls(&self, stream: TcpStream) -> Result<TlsStream<TcpStream>, Error> {
        let acceptor = self.acceptor();

        acceptor
            .accept(stream)
            .await
            .map(|s| TlsStream::Server(s))
            .map_err(|e| Error::P2PConnection(format!("TLS accept error: {}", e)))
    }
}

/// Load certificates from a PEM file
fn load_certs(path: &Path) -> Result<Vec<CertificateDer<'static>>, Error> {
    let file = File::open(path)
        .map_err(|e| Error::P2PConnection(format!("Failed to open cert file {:?}: {}", path, e)))?;
    let mut reader = BufReader::new(file);

    let certs = rustls_pemfile::certs(&mut reader)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| Error::P2PConnection(format!("Failed to parse certs: {}", e)))?;

    if certs.is_empty() {
        return Err(Error::P2PConnection(format!(
            "No certificates found in {:?}",
            path
        )));
    }

    Ok(certs)
}

/// Load a private key from a PEM file
fn load_key(path: &Path) -> Result<PrivateKeyDer<'static>, Error> {
    let file = File::open(path)
        .map_err(|e| Error::P2PConnection(format!("Failed to open key file {:?}: {}", path, e)))?;
    let mut reader = BufReader::new(file);

    // Try to read as PKCS#8 first, then EC, then RSA
    loop {
        match rustls_pemfile::read_one(&mut reader) {
            Ok(Some(rustls_pemfile::Item::Pkcs8Key(key))) => {
                return Ok(PrivateKeyDer::Pkcs8(key));
            }
            Ok(Some(rustls_pemfile::Item::Sec1Key(key))) => {
                return Ok(PrivateKeyDer::Sec1(key));
            }
            Ok(Some(rustls_pemfile::Item::Pkcs1Key(key))) => {
                return Ok(PrivateKeyDer::Pkcs1(key));
            }
            Ok(Some(_)) => continue, // Skip other items
            Ok(None) => break,
            Err(e) => return Err(Error::P2PConnection(format!("Failed to parse key: {}", e))),
        }
    }

    Err(Error::P2PConnection(format!(
        "No private key found in {:?}",
        path
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests require actual certificate files
    // In a real test environment, you'd generate test certs
    // For now, we test the error cases

    #[test]
    fn test_load_certs_missing_file() {
        let result = load_certs(Path::new("/nonexistent/cert.pem"));
        assert!(result.is_err());
    }

    #[test]
    fn test_load_key_missing_file() {
        let result = load_key(Path::new("/nonexistent/key.pem"));
        assert!(result.is_err());
    }
}
