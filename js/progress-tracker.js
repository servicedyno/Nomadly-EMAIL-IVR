/**
 * Progress Tracking System
 * Provides real-time updates for long-running operations
 */

const { translation } = require('./translation.js')

/**
 * Progress tracker for multi-step operations
 */
class ProgressTracker {
  constructor(bot, chatId, totalSteps, operation, lang = 'en') {
    this.bot = bot
    this.chatId = chatId
    this.totalSteps = totalSteps
    this.operation = operation
    this.lang = lang
    this.currentStep = 0
    this.messageId = null
    this.steps = []
  }

  /**
   * Define steps with labels
   */
  setSteps(stepLabels) {
    this.steps = stepLabels.map((label, index) => ({
      number: index + 1,
      label,
      status: 'pending', // 'pending', 'in-progress', 'completed', 'failed'
      startTime: null,
      endTime: null
    }))
  }

  /**
   * Start a step
   */
  async startStep(stepNumber, customLabel = null) {
    this.currentStep = stepNumber
    const step = this.steps[stepNumber - 1]
    if (step) {
      step.status = 'in-progress'
      step.startTime = Date.now()
      if (customLabel) step.label = customLabel
    }
    await this.updateMessage()
  }

  /**
   * Complete a step
   */
  async completeStep(stepNumber) {
    const step = this.steps[stepNumber - 1]
    if (step) {
      step.status = 'completed'
      step.endTime = Date.now()
    }
    await this.updateMessage()
  }

  /**
   * Fail a step
   */
  async failStep(stepNumber, reason = '') {
    const step = this.steps[stepNumber - 1]
    if (step) {
      step.status = 'failed'
      step.endTime = Date.now()
      step.failReason = reason
    }
    await this.updateMessage()
  }

  /**
   * Generate progress message
   */
  generateMessage() {
    const statusEmoji = {
      'pending': '⏺',
      'in-progress': '🔄',
      'completed': '✅',
      'failed': '❌'
    }

    let message = `⏳ <b>${this.operation}</b> (Step ${this.currentStep}/${this.totalSteps})\n\n`

    this.steps.forEach((step, index) => {
      const emoji = statusEmoji[step.status]
      message += `${emoji} ${step.label}\n`
      if (step.status === 'failed' && step.failReason) {
        message += `   └─ <i>${step.failReason}</i>\n`
      }
    })

    // Estimate remaining time
    const completedSteps = this.steps.filter(s => s.status === 'completed')
    if (completedSteps.length > 0 && this.currentStep < this.totalSteps) {
      const avgTime = completedSteps.reduce((sum, s) => sum + (s.endTime - s.startTime), 0) / completedSteps.length
      const remainingSteps = this.totalSteps - this.currentStep
      const estimatedSeconds = Math.ceil((avgTime * remainingSteps) / 1000)
      
      if (estimatedSeconds < 60) {
        message += `\n⏱ Estimated: ~${estimatedSeconds} seconds remaining`
      } else {
        message += `\n⏱ Estimated: ~${Math.ceil(estimatedSeconds / 60)} minutes remaining`
      }
    }

    return message
  }

  /**
   * Update progress message
   */
  async updateMessage() {
    const message = this.generateMessage()

    try {
      if (this.messageId) {
        // Edit existing message
        await this.bot.editMessageText(message, {
          chat_id: this.chatId,
          message_id: this.messageId,
          parse_mode: 'HTML'
        })
      } else {
        // Send new message
        const sent = await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' })
        this.messageId = sent.message_id
      }
    } catch (err) {
      // Message editing failed (likely too fast updates), just log
      console.error('[ProgressTracker] Update failed:', err.message)
    }
  }

  /**
   * Complete all steps
   */
  async complete(successMessage = null) {
    const message = successMessage || `✅ <b>${this.operation} Complete!</b>\n\nAll steps finished successfully.`
    
    try {
      if (this.messageId) {
        await this.bot.editMessageText(message, {
          chat_id: this.chatId,
          message_id: this.messageId,
          parse_mode: 'HTML'
        })
      } else {
        await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' })
      }
    } catch (err) {
      console.error('[ProgressTracker] Complete message failed:', err.message)
    }
  }

  /**
   * Fail the entire operation
   */
  async fail(failureMessage) {
    try {
      if (this.messageId) {
        await this.bot.editMessageText(failureMessage, {
          chat_id: this.chatId,
          message_id: this.messageId,
          parse_mode: 'HTML'
        })
      } else {
        await this.bot.sendMessage(this.chatId, failureMessage, { parse_mode: 'HTML' })
      }
    } catch (err) {
      console.error('[ProgressTracker] Fail message failed:', err.message)
    }
  }
}

/**
 * Create a progress tracker for an operation.
 * Pass `lang` (e.g. 'en'|'fr'|'zh'|'hi') so the success/failure messages render in the user's language.
 */
function createProgressTracker(bot, chatId, operation, stepLabels, lang = 'en') {
  const tracker = new ProgressTracker(bot, chatId, stepLabels.length, operation, lang)
  tracker.setSteps(stepLabels)
  return tracker
}

module.exports = {
  ProgressTracker,
  createProgressTracker
}
