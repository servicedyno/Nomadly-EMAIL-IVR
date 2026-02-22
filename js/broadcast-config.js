// Broadcast Configuration
// This file contains all broadcast-related settings that can be modified by admins

const BROADCAST_CONFIG = {
    // Batch processing settings
    BATCH_SIZE: 30, // Number of messages to send in each batch
    DELAY_BETWEEN_BATCHES: 1000, // Delay between batches in milliseconds (1 second)
    DELAY_BETWEEN_MESSAGES: 50, // Delay between individual messages in milliseconds (50ms)
    
    // Retry settings
    MAX_RETRIES: 3, // Maximum number of retry attempts for failed messages
    RETRY_DELAY: 2000, // Delay before retry in milliseconds (2 seconds)
    
    // Rate limiting (Telegram limits)
    MAX_MESSAGES_PER_SECOND: 30, // Telegram's approximate limit
    MAX_MESSAGES_PER_MINUTE: 1500, // Telegram's approximate limit
    
    // Progress reporting
    PROGRESS_UPDATE_INTERVAL: 1000, // How often to send progress updates (1 second)
    SHOW_DETAILED_PROGRESS: true, // Whether to show detailed progress for each batch
    
    // Error handling
    CONTINUE_ON_ERROR: true, // Whether to continue broadcasting if some messages fail
    LOG_FAILED_USERS: true, // Whether to log details of failed message attempts
    
    // Admin notifications
    NOTIFY_ON_COMPLETION: true, // Send completion notification to admin
    NOTIFY_ON_ERRORS: true, // Send error notifications to admin
    NOTIFY_ON_PROGRESS: true, // Send progress updates to admin
  }
  
  // Environment-based overrides
  if (process.env.BROADCAST_BATCH_SIZE) {
    BROADCAST_CONFIG.BATCH_SIZE = parseInt(process.env.BROADCAST_BATCH_SIZE)
  }
  
  if (process.env.BROADCAST_DELAY_BETWEEN_BATCHES) {
    BROADCAST_CONFIG.DELAY_BETWEEN_BATCHES = parseInt(process.env.BROADCAST_DELAY_BETWEEN_BATCHES)
  }
  
  if (process.env.BROADCAST_MAX_RETRIES) {
    BROADCAST_CONFIG.MAX_RETRIES = parseInt(process.env.BROADCAST_MAX_RETRIES)
  }
  
  // Validation
  if (BROADCAST_CONFIG.BATCH_SIZE > BROADCAST_CONFIG.MAX_MESSAGES_PER_SECOND) {
    console.warn(`Warning: BATCH_SIZE (${BROADCAST_CONFIG.BATCH_SIZE}) exceeds recommended MAX_MESSAGES_PER_SECOND (${BROADCAST_CONFIG.MAX_MESSAGES_PER_SECOND})`)
  }
  
  if (BROADCAST_CONFIG.DELAY_BETWEEN_BATCHES < 100) {
    console.warn(`Warning: DELAY_BETWEEN_BATCHES (${BROADCAST_CONFIG.DELAY_BETWEEN_BATCHES}ms) is very low and may cause rate limiting`)
  }
  
  module.exports = BROADCAST_CONFIG