/**
 * Alerts Command Alias
 * User-friendly alias for /mandates command
 */

const { handleMandatesCommand } = require('./mandates');

/**
 * Handle /alerts command - alias for /mandates
 */
async function handleAlertsCommand(bot, msg) {
  return handleMandatesCommand(bot, msg);
}

module.exports = {
  handleAlertsCommand,
};
