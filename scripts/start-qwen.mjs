#!/usr/bin/env node

/**
 * LLaVA 1.5 7B Startup Script
 * Automatically starts Ollama and pulls the LLaVA model
 * Usage: node scripts/start-qwen.mjs
 */

import { spawn, exec } from "child_process";
import { promisify } from "util";
import fetch from "node-fetch";

const execAsync = promisify(exec);

const QWEN_MODEL = "llava:7b";
const OLLAMA_API_URL = "http://localhost:11434/api/tags";
const OLLAMA_ENDPOINT = "http://localhost:11434/api/generate";

let ollamaProcess = null;

async function checkOllamaRunning() {
  try {
    const response = await fetch(OLLAMA_API_URL, { timeout: 5000 });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function startOllama() {
  console.log("🚀 Starting Ollama...");
  
  return new Promise((resolve, reject) => {
    const cmd = process.platform === "win32" ? "ollama.exe" : "ollama";
    const args = ["serve"];
    
    ollamaProcess = spawn(cmd, args, {
      stdio: "inherit",
      detached: false,
    });

    ollamaProcess.on("error", (error) => {
      console.error("❌ Failed to start Ollama:", error.message);
      console.error("Make sure Ollama is installed. Download from: https://ollama.ai");
      reject(error);
    });

    // Wait 3 seconds for Ollama to start
    setTimeout(() => {
      resolve();
    }, 3000);
  });
}

async function pullQwenModel() {
  console.log(`📥 Pulling ${QWEN_MODEL} model...`);
  console.log("⏳ This may take several minutes on first run...");

  return new Promise((resolve, reject) => {
    const cmd = process.platform === "win32" ? "ollama.exe" : "ollama";
    
    const pullProcess = spawn(cmd, ["pull", QWEN_MODEL], {
      stdio: "inherit",
    });

    pullProcess.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ ${QWEN_MODEL} model ready!`);
        resolve();
      } else {
        reject(new Error(`Failed to pull model. Exit code: ${code}`));
      }
    });

    pullProcess.on("error", (error) => {
      reject(error);
    });
  });
}

async function waitForOllamaReady(maxRetries = 30) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const isRunning = await checkOllamaRunning();
      if (isRunning) {
        console.log("✅ Ollama is running!");
        return true;
      }
    } catch (error) {
      // Ignore
    }
    
    console.log(`⏳ Waiting for Ollama... (${retries + 1}/${maxRetries})`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    retries++;
  }
  
  throw new Error("Timeout: Ollama failed to start");
}

async function testQwenModel() {
  console.log(`\n🧪 Testing ${QWEN_MODEL}...`);
  
  try {
    const response = await fetch(OLLAMA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: QWEN_MODEL,
        prompt: "Say 'Hello from Qwen!' and nothing else.",
        stream: false,
        num_predict: 20,
      }),
      timeout: 60000,
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Qwen is working!");
    console.log("Response:", data.response.trim());
    return true;
  } catch (error) {
    console.error("❌ Qwen test failed:", error.message);
    return false;
  }
}

async function main() {
  console.log("🤖 LLaVA 1.5 7B Setup Script");
  console.log("═".repeat(50));

  try {
    // Check if Ollama is already running
    const isAlreadyRunning = await checkOllamaRunning();
    
    if (!isAlreadyRunning) {
      console.log("\n1️⃣ Ollama is not running, starting it...");
      await startOllama();
      await waitForOllamaReady();
    } else {
      console.log("\n✅ Ollama is already running!");
    }

    // Check if Qwen model is available
    console.log("\n2️⃣ Checking for Qwen model...");
    try {
      const response = await fetch(OLLAMA_API_URL);
      const data = await response.json();
      const hasQwen = data.models?.some((m) => m.name.includes(QWEN_MODEL));
      
      if (!hasQwen) {
        console.log(`${QWEN_MODEL} not found. Pulling...`);
        await pullQwenModel();
      } else {
        console.log(`✅ ${QWEN_MODEL} is already available!`);
      }
    } catch (error) {
      console.error("Error checking models:", error.message);
      throw error;
    }

    // Test the model
    console.log("\n3️⃣ Testing Qwen model...");
    const testPassed = await testQwenModel();

    if (testPassed) {
      console.log("\n" + "═".repeat(50));
      console.log("✅ Setup Complete!");
      console.log("═".repeat(50));
      console.log(
        `\n🎉 ${QWEN_MODEL} is ready to use!`
      );
      console.log(`📍 API endpoint: ${OLLAMA_ENDPOINT}`);
      console.log("\nYou can now run your application:");
      console.log("  npm run dev");
      console.log("\n💡 Keep this terminal open to maintain Ollama running.");
      
      // Keep the process alive
      process.on("SIGINT", () => {
        console.log("\n\n⏹️ Shutting down Ollama...");
        if (ollamaProcess) {
          ollamaProcess.kill();
        }
        process.exit(0);
      });
      
      // Prevent the script from exiting
      await new Promise(() => {});
    } else {
      throw new Error("Qwen model test failed");
    }
  } catch (error) {
    console.error("\n❌ Setup failed:", error.message);
    console.log("\n💡 Troubleshooting:");
    console.log("1. Make sure Ollama is installed: https://ollama.ai");
    console.log("2. Ensure you have at least 8GB of free RAM");
    console.log("3. Check that port 11434 is not blocked by a firewall");
    console.log("4. Try running 'ollama serve' manually in another terminal");
    process.exit(1);
  }
}

main();
