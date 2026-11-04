//! This device's address on the local network, so the web UI can look for AI
//! servers (Redstart, Ollama, LM Studio) on the other computers around it.

use std::net::{IpAddr, UdpSocket};

/// The IPv4 address this device uses to reach other machines, or None when it has no network.
/// "Connecting" a UDP socket only picks a route; nothing is sent.
#[tauri::command]
pub fn local_ipv4() -> Option<String> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("192.0.2.1:9").ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(ip) if !ip.is_loopback() && !ip.is_unspecified() => Some(ip.to_string()),
        _ => None,
    }
}
