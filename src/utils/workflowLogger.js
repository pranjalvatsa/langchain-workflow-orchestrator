const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../logs/workflow.log');

function log(message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message,
    ...data,
  };
  const line = JSON.stringify(entry);
  fs.appendFile(LOG_FILE, line + '\n', err => {
    if (err) console.error('WorkflowLogger error:', err);
  });
  console.log('[WORKFLOW]', message, data);
}

function error(message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message,
    ...data,
  };
  const line = JSON.stringify(entry);
  fs.appendFile(LOG_FILE, line + '\n', err => {
    if (err) console.error('WorkflowLogger error:', err);
  });
  console.error('[WORKFLOW ERROR]', message, data);
}

function warn(message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: 'warn',
    message,
    ...data,
  };
  const line = JSON.stringify(entry);
  fs.appendFile(LOG_FILE, line + '\n', err => {
    if (err) console.error('WorkflowLogger error:', err);
  });
  console.warn('[WORKFLOW WARN]', message, data);
}

function info(message, data = {}) {
  log(message, data);
}

function debug(message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: 'debug',
    message,
    ...data,
  };
  const line = JSON.stringify(entry);
  fs.appendFile(LOG_FILE, line + '\n', err => {
    if (err) console.error('WorkflowLogger error:', err);
  });
  console.debug('[WORKFLOW DEBUG]', message, data);
}

module.exports = {
  log,
  error,
  warn,
  info,
  debug,
};
