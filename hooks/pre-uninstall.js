#!/usr/bin/env node
/**
 * Pre-uninstall hook for zylos-browser
 *
 * Called by Claude BEFORE CLI uninstall.
 * Stops all display services and cleans up runtime artifacts.
 */

import { execSync } from 'node:child_process';

console.log('[pre-uninstall] Stopping display services...\n');

// Stop display infrastructure (VNC + Chrome + Xvfb)
try {
  execSync('zylos-browser display stop 2>/dev/null', { stdio: 'pipe', timeout: 30000 });
  console.log('  Display services stopped.');
} catch {
  console.log('  Display services not running or already stopped.');
}

// Kill any orphaned vncconfig processes
try {
  execSync('pkill -x vncconfig 2>/dev/null', { stdio: 'pipe' });
  console.log('  Killed orphaned vncconfig.');
} catch {
  // No orphaned processes
}

// Clean stale VNC PID files
try {
  execSync('rm -f ~/.vnc/*.pid 2>/dev/null', { stdio: 'pipe' });
  console.log('  Cleaned VNC PID files.');
} catch {
  // No PID files
}

console.log('\n[pre-uninstall] Cleanup complete.');
