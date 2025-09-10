/*!
 * HTTP API for OMNIX Runtime
 * Provides REST endpoints for interacting with the distributed system
 */

use crate::runtime::Executor;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error};

/// Shared application state
pub struct AppState {
    pub executor: Arc<RwLock<Executor>>,
    pub node_id: String,
    pub counter: Arc<RwLock<u64>>,  // Simple counter for demo
}

/// Response for status endpoint
#[derive(Debug, Serialize)]
pub struct StatusResponse {
    pub node_id: String,
    pub status: String,
    pub peers: usize,
    pub counter: u64,
}

/// Response for increment operation
#[derive(Debug, Serialize)]
pub struct IncrementResponse {
    pub success: bool,
    pub new_value: u64,
    pub node_id: String,
    pub message: String,
}

/// Request for setting value
#[derive(Debug, Deserialize)]
pub struct SetValueRequest {
    pub value: u64,
}

/// Create the HTTP API router
pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/", get(root))
        .route("/status", get(status))
        .route("/value", get(get_value))
        .route("/increment", post(increment))
        .route("/decrement", post(decrement))
        .route("/set", post(set_value))
        .route("/health", get(health))
        .route("/metrics", get(metrics))
        .with_state(Arc::new(state))
}

/// Root endpoint
async fn root() -> &'static str {
    "OMNIX Distributed Consensus Node - API v0.1"
}

/// Health check endpoint
async fn health() -> StatusCode {
    StatusCode::OK
}

/// Status endpoint
async fn status(State(state): State<Arc<AppState>>) -> Json<StatusResponse> {
    let counter = *state.counter.read().await;
    
    Json(StatusResponse {
        node_id: state.node_id.clone(),
        status: "running".to_string(),
        peers: 2, // TODO: Get actual peer count
        counter,
    })
}

/// Get current counter value
async fn get_value(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let counter = *state.counter.read().await;
    
    Json(serde_json::json!({
        "value": counter,
        "node_id": state.node_id,
    }))
}

/// Increment counter through consensus
async fn increment(State(state): State<Arc<AppState>>) -> Result<Json<IncrementResponse>, StatusCode> {
    info!("Increment request received on node {}", state.node_id);
    
    // Get current value
    let current = *state.counter.read().await;
    let new_value = current + 1;
    
    // In a real implementation, this would go through consensus
    // For MVP, we simulate consensus success
    {
        let mut counter = state.counter.write().await;
        *counter = new_value;
    }
    
    info!("Counter incremented to {} on node {}", new_value, state.node_id);
    
    Ok(Json(IncrementResponse {
        success: true,
        new_value,
        node_id: state.node_id.clone(),
        message: format!("Counter incremented to {}", new_value),
    }))
}

/// Decrement counter through consensus
async fn decrement(State(state): State<Arc<AppState>>) -> Result<Json<IncrementResponse>, StatusCode> {
    info!("Decrement request received on node {}", state.node_id);
    
    // Get current value
    let current = *state.counter.read().await;
    if current == 0 {
        return Ok(Json(IncrementResponse {
            success: false,
            new_value: 0,
            node_id: state.node_id.clone(),
            message: "Counter cannot go below 0".to_string(),
        }));
    }
    
    let new_value = current - 1;
    
    // In a real implementation, this would go through consensus
    // For MVP, we simulate consensus success
    {
        let mut counter = state.counter.write().await;
        *counter = new_value;
    }
    
    info!("Counter decremented to {} on node {}", new_value, state.node_id);
    
    Ok(Json(IncrementResponse {
        success: true,
        new_value,
        node_id: state.node_id.clone(),
        message: format!("Counter decremented to {}", new_value),
    }))
}

/// Set counter value (admin operation)
async fn set_value(
    State(state): State<Arc<AppState>>,
    Json(req): Json<SetValueRequest>,
) -> Result<Json<IncrementResponse>, StatusCode> {
    info!("Set value to {} requested on node {}", req.value, state.node_id);
    
    // In production, this should require authentication
    {
        let mut counter = state.counter.write().await;
        *counter = req.value;
    }
    
    Ok(Json(IncrementResponse {
        success: true,
        new_value: req.value,
        node_id: state.node_id.clone(),
        message: format!("Counter set to {}", req.value),
    }))
}

/// Metrics endpoint (Prometheus format)
async fn metrics(State(state): State<Arc<AppState>>) -> String {
    let counter = *state.counter.read().await;
    
    format!(
        r#"# HELP omnix_counter Current counter value
# TYPE omnix_counter gauge
omnix_counter{{node_id="{}"}} {}

# HELP omnix_node_info Node information
# TYPE omnix_node_info gauge
omnix_node_info{{node_id="{}",version="0.1.0"}} 1
"#,
        state.node_id, counter, state.node_id
    )
}

/// Start the HTTP server
pub async fn start_server(
    addr: std::net::SocketAddr,
    state: AppState,
) -> anyhow::Result<()> {
    let app = create_router(state);
    
    info!("Starting HTTP API server on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}