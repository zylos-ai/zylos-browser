/**
 * Task Analyzer — post-task analysis and self-healing
 *
 * Analyzes completed browser tasks, extracts learnings,
 * and updates site knowledge.
 *
 * Ported from zylos-infra/browser-agent/cdp-service/task-analyzer.js (CJS→ESM)
 */

import { addGotcha, recordTaskResult, loadKnowledge } from './knowledge.js';

const ANALYSIS_PROMPT_TEMPLATE = `
## Post-Task Analysis

Review the browser task output and extract learnings:

### Task Output:
{output}

### Analysis Questions:

1. **Success or Failure?**
   - Did the task complete successfully?
   - If failed, at which step?

2. **New Learnings** (only if discovered something NEW):
   - Any selector that worked better than expected?
   - Any timing issue (needed more wait time)?
   - Any unexpected page behavior?
   - Any element that was hard to find?

3. **Should Update Site Knowledge?**
   - Only add genuinely new insights
   - Don't add obvious things
   - Focus on gotchas that would help future tasks

### Output Format:
- success: true/false
- learnings: [list of new gotchas, if any]
- updateTask: taskName (if successful and defined in site knowledge)
`;

/**
 * Quick heuristic analysis of task output (no LLM needed)
 *
 * @param {string} output - Task output text
 * @param {string} url - Current page URL
 * @param {string} taskName - Name of the task
 * @returns {{ success: string, confidence: string, learnings: string[] }}
 */
export function analyzeResult(output, url, taskName) {
  const successIndicators = [
    'successfully', 'completed', 'done', 'task complete', '成功'
  ];
  const failureIndicators = [
    'failed', 'error', 'could not', 'unable to', 'timeout', '失败',
    'not found', 'timed out'
  ];

  const lower = output.toLowerCase();
  const hasSuccess = successIndicators.some(s => lower.includes(s));
  const hasFailure = failureIndicators.some(s => lower.includes(s));

  const learnings = [];

  // Extract potential learnings from failure patterns
  if (hasFailure) {
    if (lower.includes('timeout') || lower.includes('timed out')) {
      learnings.push('Operation timed out — may need longer wait or different approach');
    }
    if (lower.includes('not found') || lower.includes('element not found')) {
      learnings.push('Element not found — page structure may have changed');
    }
  }

  let success;
  let confidence;
  if (hasFailure) {
    success = 'failure';
    confidence = 'low';
  } else if (hasSuccess) {
    success = 'success';
    confidence = 'low';
  } else {
    success = 'unknown';
    confidence = 'none';
  }

  return { success, confidence, learnings, suggestedRetry: hasFailure ? 'retry with fresh snapshot' : undefined };
}

/**
 * Generate a prompt for Claude to do deep analysis of task output
 *
 * @param {string} taskOutput - The task's output/result
 * @param {string} url - Current page URL
 * @param {string} taskName - Name of the task
 * @returns {string} Prompt for Claude
 */
export function generateAnalysisPrompt(taskOutput, url, taskName) {
  const knowledge = loadKnowledge(url);

  let prompt = ANALYSIS_PROMPT_TEMPLATE.replace('{output}', taskOutput);

  if (taskName) {
    prompt += `\n### Task: ${taskName}\n`;
  }

  if (knowledge) {
    prompt += `\n### Existing Knowledge for ${knowledge.domain}:\n`;
    prompt += `- Known gotchas: ${knowledge.gotchas.length}\n`;
    prompt += `- Known tasks: ${Object.keys(knowledge.tasks).join(', ') || 'none'}\n`;
    prompt += `\nDon't add learnings that duplicate existing gotchas.\n`;
  }

  return prompt;
}

/**
 * Apply learnings from analysis to site knowledge
 *
 * @param {string} url - Current page URL
 * @param {{ success: boolean, learnings: string[], updateTask: string }} analysis
 * @returns {{ gotchasAdded: number, taskUpdated: boolean }}
 */
export function applyLearnings(url, analysis) {
  const results = {
    gotchasAdded: 0,
    taskUpdated: false
  };

  // Add new gotchas
  if (analysis.learnings && Array.isArray(analysis.learnings)) {
    for (const learning of analysis.learnings) {
      if (learning && typeof learning === 'string') {
        const added = addGotcha(url, learning);
        if (added) results.gotchasAdded++;
      }
    }
  }

  // Record task result
  if (analysis.updateTask) {
    const updated = recordTaskResult(url, analysis.updateTask, !!analysis.success);
    if (updated) results.taskUpdated = true;
  }

  return results;
}
