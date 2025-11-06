const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
dayjs.extend(timezone);

class TimezoneUtils {
  // Vietnam timezone
  static VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

  /**
   * Convert any date to Vietnam timezone
   * @param {Date|string|number} date - Date to convert
   * @returns {dayjs.Dayjs} - Date in Vietnam timezone
   */
  
  static toVietnamTime(date) {
    if (!date) return dayjs().tz(this.VIETNAM_TZ);
    
    return dayjs(date).tz(this.VIETNAM_TZ);
  }

  /**
   * Get current time in Vietnam timezone
   * @returns {dayjs.Dayjs} - Current time in Vietnam timezone
   */
  static now() {
    return dayjs().tz(this.VIETNAM_TZ);
  }

  /**
   * Format date to Vietnam timezone string
   * @param {Date|string|number} date - Date to format
   * @param {string} format - Format string (default: 'YYYY-MM-DD HH:mm:ss')
   * @returns {string} - Formatted date string in Vietnam timezone
   */
  static formatVietnamTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
    return this.toVietnamTime(date).format(format);
  }

  /**
   * Convert date to database format (MySQL datetime)
   * @param {Date|string|number} date - Date to convert
   * @returns {string} - MySQL datetime format string in Vietnam timezone
   */
  static toDatabaseFormat(date) {
    return this.toVietnamTime(date).format('YYYY-MM-DD HH:mm:ss');
  }

  /**
   * Create a new Date object in Vietnam timezone
   * @param {string} dateString - Date string (e.g., '2024-01-15 10:30:00')
   * @returns {Date} - Date object representing the time in Vietnam timezone
   */
  static createVietnamDate(dateString) {
    return this.toVietnamTime(dateString).toDate();
  }

  /**
   * Convert UTC date to Vietnam timezone
   * @param {Date|string} utcDate - UTC date
   * @returns {dayjs.Dayjs} - Date in Vietnam timezone
   */
  static fromUTC(utcDate) {
    return dayjs.utc(utcDate).tz(this.VIETNAM_TZ);
  }

  /**
   * Convert Vietnam timezone date to UTC
   * @param {Date|string} vietnamDate - Date in Vietnam timezone
   * @returns {dayjs.Dayjs} - Date in UTC
   */
  static toUTC(vietnamDate) {
    return this.toVietnamTime(vietnamDate).utc();
  }

  /**
   * Get timezone offset for Vietnam
   * @returns {number} - Timezone offset in minutes (+420 for UTC+7)
   */
  static getOffset() {
    return dayjs().tz(this.VIETNAM_TZ).utcOffset();
  }

  /**
   * Check if date is in Vietnam timezone
   * @param {Date|string} date - Date to check
   * @returns {boolean} - True if date is in Vietnam timezone
   */
  static isVietnamTime(date) {
    const vietnamTime = this.toVietnamTime(date);
    const utcTime = dayjs(date).utc();
    return vietnamTime.utcOffset() === this.getOffset();
  }

  /**
   * Get start of day in Vietnam timezone
   * @param {Date|string} date - Date (optional, defaults to now)
   * @returns {dayjs.Dayjs} - Start of day in Vietnam timezone
   */
  static startOfDay(date) {
    return this.toVietnamTime(date).startOf('day');
  }

  /**
   * Get end of day in Vietnam timezone
   * @param {Date|string} date - Date (optional, defaults to now)
   * @returns {dayjs.Dayjs} - End of day in Vietnam timezone
   */
  static endOfDay(date) {
    return this.toVietnamTime(date).endOf('day');
  }

  /**
   * Add time to date in Vietnam timezone
   * @param {Date|string} date - Base date
   * @param {number} amount - Amount to add
   * @param {string} unit - Unit (minutes, hours, days, etc.)
   * @returns {dayjs.Dayjs} - New date in Vietnam timezone
   */
  static add(date, amount, unit) {
    return this.toVietnamTime(date).add(amount, unit);
  }

  /**
   * Subtract time from date in Vietnam timezone
   * @param {Date|string} date - Base date
   * @param {number} amount - Amount to subtract
   * @param {string} unit - Unit (minutes, hours, days, etc.)
   * @returns {dayjs.Dayjs} - New date in Vietnam timezone
   */
  static subtract(date, amount, unit) {
    return this.toVietnamTime(date).subtract(amount, unit);
  }
}

module.exports = TimezoneUtils;
