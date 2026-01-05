diff --git a/test-pi.sh b/test-pi.sh
new file mode 100755
index 0000000000000000000000000000000000000000..2a2e4d8ddf2013afe8cecc9e5a2696ccca217caa
--- /dev/null
+++ b/test-pi.sh
@@ -0,0 +1,46 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+cd "$script_dir"
+
+if ! command -v node >/dev/null 2>&1; then
+  echo "Node.js is required but was not found in PATH."
+  exit 1
+fi
+
+echo "MMM-Fintech Raspberry Pi test script"
+echo "Node: $(node -v)"
+if command -v npm >/dev/null 2>&1; then
+  echo "npm: $(npm -v)"
+fi
+
+ran_any=false
+
+if [ -f "test-coinbase.js" ]; then
+  if [ -f "cdp-credentials.enc" ]; then
+    echo "Running Coinbase provider test..."
+    node test-coinbase.js
+    ran_any=true
+  else
+    echo "Skipping Coinbase test (cdp-credentials.enc not found)."
+  fi
+else
+  echo "Skipping Coinbase test (test-coinbase.js not found)."
+fi
+
+if [ -f "test-twelvedata.js" ]; then
+  if [ -f "twelvedata-credentials.enc" ]; then
+    echo "Running Twelve Data provider test..."
+    node test-twelvedata.js
+    ran_any=true
+  else
+    echo "Skipping Twelve Data test (twelvedata-credentials.enc not found)."
+  fi
+else
+  echo "Skipping Twelve Data test (test-twelvedata.js not found)."
+fi
+
+if [ "$ran_any" = false ]; then
+  echo "No provider tests were run."
+fi
