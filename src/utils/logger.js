const db = require('../config/database');

class Logger {
  // Log to console and database
  static async log(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    
    // Console log
    const emoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      debug: '🔍'
    };

    console.log(`${emoji[level] || '📝'} [${timestamp}] ${level.toUpperCase()}: ${message}`, 
      Object.keys(metadata).length > 0 ? metadata : '');

    // Database log (async, don't wait)
    try {
      const sql = `
        INSERT INTO system_logs (log_level, source, message, metadata)
        VALUES (?, ?, ?, ?)
      `;
      
      const metadataJson = Object.keys(metadata).length > 0 
        ? JSON.stringify(metadata) 
        : null;

      await db.query(sql, [
        level,
        metadata.source || 'backend',
        message,
        metadataJson
      ]);
    } catch (error) {
      // Don't throw errors from logger
      console.error('Logger database error:', error.message);
    }
  }

  static info(message, metadata = {}) {
    return this.log('info', message, metadata);
  }

  static warning(message, metadata = {}) {
    return this.log('warning', message, metadata);
  }

  // Backwards-compatible alias
  static warn(message, metadata = {}) {
    return this.warning(message, metadata);
  }

  static error(message, metadata = {}) {
    return this.log('error', message, metadata);
  }

  static debug(message, metadata = {}) {
    if (process.env.NODE_ENV === 'development') {
      return this.log('debug', message, metadata);
    }
  }
}

module.exports = Logger;

