#!/bin/bash

# LLaVA 1.5 7B Startup Script for macOS/Linux
# This script automatically starts Ollama and the dev server

echo ""
echo "============================================================"
echo "  Educalcul - LLaVA 1.5 7B Local AI Setup"
echo "============================================================"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "[ERROR] Ollama is not installed!"
    echo ""
    echo "Please install Ollama from: https://ollama.ai"
    echo ""
    exit 1
fi

# Check if Ollama is already running
echo "[INFO] Checking if Ollama is already running..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "[SUCCESS] Ollama is already running!"
else
    echo "[INFO] Starting Ollama service..."
    
    # Try to start Ollama
    if ! ollama serve &> /tmp/ollama.log &; then
        echo "[ERROR] Failed to start Ollama"
        cat /tmp/ollama.log
        exit 1
    fi
    
    # Wait for Ollama to be ready
    echo "[INFO] Waiting for Ollama to start (up to 30 seconds)..."
    retries=0
    while [ $retries -lt 30 ]; do
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo "[SUCCESS] Ollama is ready!"
            break
        fi
        sleep 1
        ((retries++))
    done
    
    if [ $retries -eq 30 ]; then
        echo "[ERROR] Ollama failed to start!"
        cat /tmp/ollama.log
        exit 1
    fi
fi

echo ""
echo "[INFO] Checking for LLaVA 1.5 7B model..."
if ollama list | grep -q "llava:7b"; then
    echo "[SUCCESS] LLaVA model found!"
else
    echo "[INFO] LLaVA model not found. Pulling it now..."
    echo "[NOTE] First run may take 10+ minutes..."
    echo ""
    ollama pull llava:7b
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to pull Qwen model"
        exit 1
    fi
fi

echo ""
echo "============================================================"
echo "[SUCCESS] LLaVA 1.5 7B is ready!"
echo "============================================================"
echo ""
echo "[INFO] Starting development server..."
echo ""

# Start the dev server
npm run dev

