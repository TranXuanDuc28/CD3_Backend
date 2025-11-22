/**
 * Template Engine for replacing variables in prompts with workflow data
 */

class TemplateEngine {
  /**
   * Replace template variables with actual data
   * @param {string} template - Template string with variables like {{ $json.content }}
   * @param {object} data - Data object containing the values to replace
   * @returns {string} - Processed template with variables replaced
   */
  static processTemplate(template, data = {}) {
    if (!template || typeof template !== 'string') {
      return template;
    }
    

    let processedTemplate = template;

    // Replace {{ $('Node Name').item.json.field }} patterns first (most specific)
    processedTemplate = processedTemplate.replace(/\{\{\s*\$\(['"]([^'"]+)['"]\)\.item\.json\.(\w+)\s*\}\}/g, (match, nodeName, field) => {
      const nodeData = data[nodeName] || {};
      return nodeData[field] || '';
    });

    // Replace {{ $json.field }} patterns
    processedTemplate = processedTemplate.replace(/\{\{\s*\$json\.(\w+)\s*\}\}/g, (match, field) => {
      return data[field] || '';
    });

    // Replace simple {{ field }} patterns (least specific, do last)
    processedTemplate = processedTemplate.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, field) => {
      return data[field] || '';
    });

    // Clean up any remaining template syntax
    processedTemplate = processedTemplate.replace(/\{\{\s*[^}]+\s*\}\}/g, '');

    return processedTemplate;
  }

  /**
   * Sanitize prompt for Gemini API
   * @param {string} prompt - Prompt string
   * @returns {string} - Sanitized prompt
   */
  static sanitizePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') {
      return '';
    }

    // Remove any remaining template syntax
    let sanitized = prompt.replace(/\{\{\s*[^}]+\s*\}\}/g, '');
    
    // Remove excessive whitespace
    sanitized = sanitized.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Ensure prompt is not empty
    if (!sanitized) {
      return 'Hãy trả lời câu hỏi của khách hàng một cách thân thiện và chuyên nghiệp.';
    }

    return sanitized;
  }

  /**
   * Extract variables from template
   * @param {string} template - Template string
   * @returns {array} - Array of variable names found in template
   */
  static extractVariables(template) {
    if (!template || typeof template !== 'string') {
      return [];
    }

    const variables = new Set();
    
    // Find {{ $json.field }} patterns
    const jsonMatches = template.match(/\{\{\s*\$json\.(\w+)\s*\}\}/g);
    if (jsonMatches) {
      jsonMatches.forEach(match => {
        const field = match.match(/\$json\.(\w+)/)[1];
        variables.add(field);
      });
    }

    // Find {{ $('Node Name').item.json.field }} patterns
    const nodeMatches = template.match(/\{\{\s*\$\(['"]([^'"]+)['"]\)\.item\.json\.(\w+)\s*\}\}/g);
    if (nodeMatches) {
      nodeMatches.forEach(match => {
        const [, nodeName, field] = match.match(/\$\(['"]([^'"]+)['"]\)\.item\.json\.(\w+)/);
        variables.add(`${nodeName}.${field}`);
      });
    }

    // Find simple {{ field }} patterns
    const simpleMatches = template.match(/\{\{\s*(\w+)\s*\}\}/g);
    if (simpleMatches) {
      simpleMatches.forEach(match => {
        const field = match.match(/\{\{\s*(\w+)\s*\}\}/)[1];
        variables.add(field);
      });
    }

    return Array.from(variables);
  }

  /**
   * Validate template - check if all variables can be resolved
   * @param {string} template - Template string
   * @param {object} data - Available data
   * @returns {object} - Validation result
   */
  static validateTemplate(template, data = {}) {
    const variables = this.extractVariables(template);
    const missing = [];
    const available = [];

    variables.forEach(variable => {
      if (variable.includes('.')) {
        // Node.field format
        const [nodeName, field] = variable.split('.');
        if (data[nodeName] && data[nodeName][field] !== undefined) {
          available.push(variable);
        } else {
          missing.push(variable);
        }
      } else {
        // Simple field
        if (data[variable] !== undefined) {
          available.push(variable);
        } else {
          missing.push(variable);
        }
      }
    });

    return {
      valid: missing.length === 0,
      variables,
      available,
      missing,
      processedTemplate: this.processTemplate(template, data)
    };
  }
}

module.exports = TemplateEngine;
