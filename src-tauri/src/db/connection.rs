use crate::models::types::ServerProfile;
use tiberius::{AuthMethod, Client, Config, EncryptionLevel};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};
use tokio_util::compat::{Compat, TokioAsyncWriteCompatExt};

pub async fn create_client(
    profile: &ServerProfile,
    database: Option<&str>,
    connect_timeout_ms: u64,
) -> Result<Client<Compat<TcpStream>>, String> {
    let mut config = Config::new();
    config.host(&profile.server);
    config.port(profile.port);
    config.authentication(AuthMethod::sql_server(&profile.username, &profile.password));

    if profile.encrypt {
        config.encryption(EncryptionLevel::Required);
    } else {
        config.encryption(EncryptionLevel::NotSupported);
    }

    if profile.trust_server_certificate {
        config.trust_cert();
    }

    if let Some(db) = database {
        config.database(db);
    }

    let tcp = if connect_timeout_ms == 0 {
        TcpStream::connect(config.get_addr())
            .await
            .map_err(|e| format!("TCP connect to {}:{} failed: {}", profile.server, profile.port, e))?
    } else {
        timeout(Duration::from_millis(connect_timeout_ms), TcpStream::connect(config.get_addr()))
            .await
            .map_err(|_| format!("TCP connect to {}:{} timed out after {}ms", profile.server, profile.port, connect_timeout_ms))?
            .map_err(|e| format!("TCP connect to {}:{} failed: {}", profile.server, profile.port, e))?
    };
    tcp.set_nodelay(true).map_err(|e| e.to_string())?;

    match Client::connect(config.clone(), tcp.compat_write()).await {
        Ok(client) => Ok(client),
        // SQL Server gateway redirect — reconnect to actual server
        Err(tiberius::error::Error::Routing { host, port }) => {
            let mut routing_config = config;
            routing_config.host(&host);
            routing_config.port(port);

            let tcp = if connect_timeout_ms == 0 {
                TcpStream::connect(routing_config.get_addr())
                    .await
                    .map_err(|e| format!("Routing TCP connect to {}:{} failed: {}", host, port, e))?
            } else {
                timeout(Duration::from_millis(connect_timeout_ms), TcpStream::connect(routing_config.get_addr()))
                    .await
                    .map_err(|_| format!("Routing TCP connect to {}:{} timed out", host, port))?
                    .map_err(|e| format!("Routing TCP connect to {}:{} failed: {}", host, port, e))?
            };
            tcp.set_nodelay(true).map_err(|e| e.to_string())?;

            Client::connect(routing_config, tcp.compat_write())
                .await
                .map_err(|e| format!("Routing connection failed: {}", e))
        }
        Err(e) => Err(format!("Connection failed: {}", e)),
    }
}
