
/**
 * Exam JSON Parser "Engine"
 * 
 * Handles parsing and validation of exam configuration files.
 * Supports:
 * 1. Legacy Check: Array of questions
 * 2. Standard Format: { config: {...}, questions: [...] }
 */

export function parseExamJson(jsonString) {
    try {
        const json = JSON.parse(jsonString);

        // Mode 1: Array of Questions (Legacy)
        if (Array.isArray(json)) {
            return {
                valid: true,
                format: 'legacy',
                data: {
                    questions: json,
                    config: {} // No config in legacy
                }
            };
        }

        // Mode 2: Standard Format
        if (json.questions && Array.isArray(json.questions)) {
            const config = json.config || {};

            // Normalize Config
            const normalizedConfig = {
                title: config.title || '',
                durationMinutes: config.durationMinutes || 60,
                maxStudents: config.maxStudents || 50,
                startTime: config.startTime || '',
                marking: config.marking || { correct: 4, incorrect: -1 },
                proctoring: config.proctoring || { requireMobile: false, showResults: true }
            };

            return {
                valid: true,
                format: 'standard',
                data: {
                    questions: json.questions,
                    config: normalizedConfig
                }
            };
        }

        return {
            valid: false,
            error: 'Invalid JSON structure. Root must be an array of questions OR an object with a "questions" array.'
        };

    } catch (error) {
        return {
            valid: false,
            error: `JSON Syntax Error: ${error.message}`
        };
    }
}
