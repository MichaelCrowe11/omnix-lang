#!/bin/bash

# Test script for OMNIX HTTP API
# Demonstrates consensus operations via REST endpoints

set -e

echo "🧪 OMNIX HTTP API Test"
echo "======================"
echo ""

# Base URLs for 3 nodes
NODE1="http://localhost:8080"
NODE2="http://localhost:8081"
NODE3="http://localhost:8082"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to check if node is running
check_node() {
    local url=$1
    local node_name=$2
    
    if curl -s -f "$url/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $node_name is healthy"
        return 0
    else
        echo "✗ $node_name is not responding"
        return 1
    fi
}

# Function to get counter value
get_value() {
    local url=$1
    curl -s "$url/value" | jq -r '.value // 0'
}

# Function to get status
get_status() {
    local url=$1
    curl -s "$url/status" | jq '.'
}

# Function to increment counter
increment() {
    local url=$1
    local response=$(curl -s -X POST "$url/increment")
    echo "$response" | jq '.'
}

# Function to decrement counter
decrement() {
    local url=$1
    local response=$(curl -s -X POST "$url/decrement")
    echo "$response" | jq '.'
}

echo "Checking node health..."
echo "------------------------"
check_node "$NODE1" "Node 1"
check_node "$NODE2" "Node 2"
check_node "$NODE3" "Node 3"
echo ""

echo "Initial counter values:"
echo "----------------------"
echo "Node 1: $(get_value $NODE1)"
echo "Node 2: $(get_value $NODE2)"
echo "Node 3: $(get_value $NODE3)"
echo ""

echo -e "${YELLOW}Testing increment on Node 1...${NC}"
increment "$NODE1"
sleep 1
echo ""

echo "After increment:"
echo "---------------"
echo "Node 1: $(get_value $NODE1)"
echo "Node 2: $(get_value $NODE2)"
echo "Node 3: $(get_value $NODE3)"
echo ""

echo -e "${YELLOW}Testing increment on Node 2...${NC}"
increment "$NODE2"
sleep 1
echo ""

echo "After second increment:"
echo "----------------------"
echo "Node 1: $(get_value $NODE1)"
echo "Node 2: $(get_value $NODE2)"
echo "Node 3: $(get_value $NODE3)"
echo ""

echo -e "${YELLOW}Testing decrement on Node 3...${NC}"
decrement "$NODE3"
sleep 1
echo ""

echo "Final values:"
echo "------------"
echo "Node 1: $(get_value $NODE1)"
echo "Node 2: $(get_value $NODE2)"
echo "Node 3: $(get_value $NODE3)"
echo ""

echo "Node Status:"
echo "-----------"
echo "Node 1:"
get_status "$NODE1"
echo ""

echo -e "${GREEN}✅ Test complete!${NC}"
echo ""
echo "Try these commands:"
echo "  curl $NODE1/status | jq"
echo "  curl -X POST $NODE1/increment | jq"
echo "  curl $NODE1/value | jq"