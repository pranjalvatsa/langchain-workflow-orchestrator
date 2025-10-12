const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../logs/workflow.log');

function log(message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    message,
    ...data,
  };
  const line = JSON.stringify(entry);
  fs.appendFile(LOG_FILE, line + '\n', err => {
    if (err) console.error('WorkflowLogger error:', err);
  });
  console.log('[WORKFLOW]', message, data);
}

module.exports = {
  log,
};
